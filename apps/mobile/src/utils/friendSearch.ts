export type FriendSearchResult = {
  found: boolean;
  user?: any;
  friendship?: any;
  isSelf?: boolean;
};

export const DEFAULT_FRIEND_AVATAR =
  "https://ui-avatars.com/api/?name=UniChat&background=0052AA&color=fff&bold=true";

export const buildFriendSearchParams = (raw: string) => {
  const value = String(raw || "").trim();
  if (value.length < 2) return null;

  const digits = value.replace(/[^\d]/g, "");
  const isPhone = /^\d+$/.test(value) || !value.includes("@");
  if (isPhone) return { phone: digits || value };

  return { email: value.toLowerCase() };
};

export const unpackFriendSearchResponse = (res: any): FriendSearchResult => {
  const data = res?.data && (res.data.found !== undefined || res.data.user)
    ? res.data
    : res;

  return {
    found: Boolean(data?.found),
    user: data?.user,
    friendship: data?.friendship,
    isSelf: Boolean(data?.isSelf),
  };
};

export const getFriendDisplayName = (user: any, fallback = "") => (
  user?.nickname ||
  user?.fullName ||
  user?.fullname ||
  user?.displayName ||
  user?.email ||
  fallback
);

export const getFriendAvatar = (user: any) => (
  user?.avatarUrl ||
  user?.urlAvatar ||
  user?.avatar ||
  DEFAULT_FRIEND_AVATAR
);
