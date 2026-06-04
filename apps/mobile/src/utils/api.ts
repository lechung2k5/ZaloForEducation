import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeModules, Platform } from "react-native";

const resolveApiUrl = (): string => {
  const configured = String(process.env.EXPO_PUBLIC_API_URL || "").trim();
  if (configured) return configured;

  const scriptURL = NativeModules?.SourceCode?.scriptURL || "";
  const match = scriptURL.match(/https?:\/\/([^/:]+)/i);
  const host = match?.[1];

  if (host) {
    if (host === "localhost" || host === "127.0.0.1") {
      if (Platform.OS === "android") {
        return "http://10.0.2.2:3000";
      }
      return "http://localhost:3000";
    }
    return `http://${host}:3000`;
  }

  return Platform.OS === "android"
    ? "http://10.0.2.2:3000"
    : "http://localhost:3000";
};

export const API_URL = resolveApiUrl();
const DEFAULT_TIMEOUT_MS = 12000;

const decodeJwtPayload = (token: string): { exp?: number } | null => {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(globalThis.atob(normalized));
  } catch {
    return null;
  }
};

let refreshPromise: Promise<string | null> | null = null;

export async function refreshAccessToken() {
  const token = await AsyncStorage.getItem("token");
  if (!token) return null;

  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    })
      .then(async (res) => {
        if (!res.ok) return null;
        const data = await res.json();
        if (data?.accessToken) {
          await AsyncStorage.setItem("token", data.accessToken);
          return data.accessToken;
        }
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

export async function ensureFreshAccessToken() {
  const token = await AsyncStorage.getItem("token");
  if (!token) return null;

  const payload = decodeJwtPayload(token);
  const expiresAtMs = (payload?.exp || 0) * 1000;
  if (expiresAtMs && expiresAtMs - Date.now() > 60_000) {
    return token;
  }

  return refreshAccessToken();
}

export interface ApiResponse<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  message?: string;
  [key: string]: any;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: any = {},
): Promise<ApiResponse<T>> {
  const token = await ensureFreshAccessToken();
  const timeoutMs = Number(options.timeoutMs || DEFAULT_TIMEOUT_MS);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const isFormData = options.body && typeof options.body.append === "function";
  const headers: Record<string, string> = {
    ...(!options.headers?.["Content-Type"] && !isFormData
      ? { "Content-Type": "application/json" }
      : {}),
    ...options.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      timeoutMs: undefined,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 401) {
      let data: any = {};
      try {
        data = await response.json();
      } catch (e) {
        console.warn("[API] Non-JSON 401 response");
      }

      if (data.message === "SESSION_INVALIDATED") {
        console.error("[API] Session invalidated detected.");
        // handleForceLogout globally if needed
        throw new Error("SESSION_INVALIDATED");
      }

      const refreshedToken = await refreshAccessToken();
      if (refreshedToken && !options.__retried) {
        return apiRequest(endpoint, { ...options, __retried: true });
      }

      return { ok: false, status: 401, ...data };
    }

    let data: any = {};
    const text = await response.text();
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = { message: text };
    }

    return {
      ok: response.ok,
      status: response.status,
      ...data,
      data: data?.data ?? data,
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error?.name === "AbortError") {
      throw new Error(`REQUEST_TIMEOUT_${timeoutMs}MS`);
    }
    throw error;
  }
}

export const chatGet = (path: string, query?: any) => {
  const queryString = query ? `?${new URLSearchParams(query).toString()}` : "";
  return apiRequest(`/chat${path}${queryString}`, { method: "GET" });
};

export const chatPost = (path: string, body: any) =>
  apiRequest(`/chat${path}`, { method: "POST", body: JSON.stringify(body) });

export const apiPut = (path: string, body: any) =>
  apiRequest(`${path}`, { method: "PUT", body: JSON.stringify(body) });

export const apiGet = (path: string, query?: any) => {
  const queryString = query ? `?${new URLSearchParams(query).toString()}` : "";
  return apiRequest(`${path}${queryString}`, { method: "GET" });
};

export const apiPost = (path: string, body: any) =>
  apiRequest(`${path}`, { method: "POST", body: JSON.stringify(body) });

export const apiPatch = (path: string, body: any) =>
  apiRequest(`${path}`, { method: "PATCH", body: JSON.stringify(body) });

export const apiDelete = (path: string, body?: any) =>
  apiRequest(`${path}`, {
    method: "DELETE",
    body: body ? JSON.stringify(body) : undefined,
  });

export const apiUpload = async (endpoint: string, file: any) => {
  // On web, use traditional FormData + fetch
  if (Platform.OS === "web") {
    const formData = new FormData();
    try {
      const uri: string = file.uri;
      let blob: Blob;
      if (uri.startsWith("data:")) {
        const res = await fetch(uri);
        blob = await res.blob();
      } else {
        const res = await fetch(uri);
        blob = await res.blob();
      }
      const filename = file.name || `upload_${Date.now()}.jpg`;
      formData.append("file", blob, filename as any);
    } catch (err) {
      formData.append("file", file as any);
    }
    
    return apiRequest(endpoint, {
      method: "POST",
      body: formData,
      timeoutMs: 60000,
    });
  } else {
    // On native, use expo-file-system to bypass RN networking bugs entirely
    try {
      let FileSystem;
      try {
        FileSystem = require("expo-file-system/legacy");
      } catch (e) {
        FileSystem = require("expo-file-system");
      }
      const token = await AsyncStorage.getItem("token");
      const url = `${API_URL}${endpoint}`;
      
      const androidUri = Platform.OS === "android" ? file.uri : file.uri.replace("file://", "");
      const finalType = file.mimeType || (file.type && file.type.includes('/') ? file.type : "image/jpeg");
      
      const uploadResult = await FileSystem.uploadAsync(url, androidUri, {
        httpMethod: 'POST',
        uploadType: 1, // 1 = FileSystemUploadType.MULTIPART
        fieldName: 'file',
        mimeType: finalType,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      
      let parsedBody;
      try {
        parsedBody = JSON.parse(uploadResult.body);
      } catch (e) {
        parsedBody = uploadResult.body;
      }
      
      const isSuccess = uploadResult.status >= 200 && uploadResult.status < 300;
      return {
        ok: isSuccess,
        status: uploadResult.status,
        data: parsedBody?.data || parsedBody,
        ...parsedBody,
      };
    } catch (error: any) {
      console.error("[apiUpload] FileSystem.uploadAsync failed:", error);
      throw new Error("Network request failed");
    }
  }
};

export const chatPatch = (path: string, body: any) =>
  apiRequest(`/chat${path}`, { method: "PATCH", body: JSON.stringify(body) });

export const chatDelete = (path: string, body?: any) =>
  apiRequest(`/chat${path}`, {
    method: "DELETE",
    body: body ? JSON.stringify(body) : undefined,
  });

export const chatUpload = (file: any) => apiUpload("/chat/uploads", file);
