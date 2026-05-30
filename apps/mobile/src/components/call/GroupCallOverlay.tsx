import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Vibration,
  StyleSheet,
  PanResponder,
  Animated,
  Dimensions,
  Alert,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useGroupCallStore } from "../../store/groupCallStore";
import { useAuth } from "../../context/AuthContext";
import { useGroupChime } from "../../hooks/useGroupChime";
import { RNChimeVideoView } from "../../bridge/chime";
import { apiRequest } from "../../utils/api";
import SocketService from "../../utils/socket";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export const GroupCallOverlay: React.FC = () => {
  const { user } = useAuth();
  const {
    callState,
    convId,
    callId,
    callType,
    fromEmail,
    participants,
    groupName,
    groupAvatar,
    videoTiles,
    isMinimized,
    toggleMinimized,
    resetGroupCall,
  } = useGroupCallStore();

  const {
    localTileId,
    setupSession,
    cleanup,
    toggleMic,
    toggleCamera,
    switchAudioOutput,
    switchCamera,
    requestPermissions,
  } = useGroupChime() as any;

  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [useSpeaker, setUseSpeaker] = useState(true);

  useEffect(() => {
    const store = useGroupCallStore.getState();
    if (store.meetingData && store.attendeeData) {
      setupSession(store.meetingData, store.attendeeData);
    }
  }, [setupSession]);

  // Animation values for Minimized PiP
  const pan = useRef(new Animated.ValueXY()).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: () => {
        pan.flattenOffset();
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
        }).start();
      },
    })
  ).current;

  const endCall = useCallback(async () => {
    try {
      if (SocketService.socket && convId && callId) {
        (SocketService.socket as any).emit("group_call:leave", {
          convId,
          callId,
          email: user?.email,
        });
      }
      await cleanup("user_ended_call");
    } catch (error) {
      console.error("[GroupCall] End call error:", error);
      resetGroupCall();
    }
  }, [convId, callId, user?.email, cleanup, resetGroupCall]);

  const handleToggleMic = () => {
    const nextState = !isMicOn;
    setIsMicOn(nextState);
    toggleMic(nextState);
  };

  const handleToggleCamera = async () => {
    const nextState = !isCameraOn;
    const hasPerm = await requestPermissions();
    if (!hasPerm) return;
    setIsCameraOn(nextState);
    toggleCamera(nextState);
  };

  const handleSwitchAudio = () => {
    const nextState = !useSpeaker;
    setUseSpeaker(nextState);
    switchAudioOutput(nextState);
  };

  if (callState === "IDLE") return null;

  const isLocalCameraOn = isCameraOn && localTileId !== null;
  const contentTile = videoTiles.find((t: any) => t.isContent);
  const cameraTiles = videoTiles.filter((t: any) => !t.isContent);

  // LÃ¡y danh sÃ¡ch participant cÃ³ mÄƒÌ£t
  const connectedParticipants = Object.values(participants).filter(
    (p: any) => p.status === "connected" && p.email !== user?.email
  );

  // --- MINIMIZED VIEW ---
  if (isMinimized && callState === "CONNECTED") {
    return (
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.minimizedContainer,
          { transform: pan.getTranslateTransform() },
        ]}
      >
        <TouchableOpacity
          style={styles.minimizedContent}
          onPress={() => toggleMinimized(false)}
        >
          {isLocalCameraOn ? (
            <RNChimeVideoView
              tileId={localTileId}
              zOrder={2}
              style={StyleSheet.absoluteFillObject}
            />
          ) : (
            <View style={styles.minimizedAvatarContainer}>
              <Text style={{ color: "white", fontWeight: "bold" }}>Group</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.endCallMiniBtn} onPress={endCall}>
          <Icon name="phone-hangup" size={16} color="white" />
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // --- FULLSCREEN VIEW ---
  return (
    <SafeAreaView style={styles.fullContainer}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => toggleMinimized(true)}>
          <Icon name="chevron-down" size={32} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{groupName || "Group Call"}</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Main Video Area */}
      <View style={styles.videoGridContainer}>
        {contentTile ? (
          // CONTENT SHARE MODE
          <View style={styles.contentShareLayout}>
            <View style={styles.contentShareMain}>
              <RNChimeVideoView
                tileId={contentTile.tileId}
                objectFit="contain"
                zOrder={0}
                style={StyleSheet.absoluteFillObject}
              />
              <Text style={styles.contentLabel}>MÃ n hÃ¬nh Ä‘Æ°á»£c chia sáº»</Text>
            </View>
            <ScrollView horizontal style={styles.contentShareRoster}>
              {cameraTiles.map((tile: any) => (
                <View key={tile.tileId} style={styles.miniTile}>
                  <RNChimeVideoView
                    tileId={tile.tileId}
                    zOrder={1}
                    style={StyleSheet.absoluteFillObject}
                  />
                </View>
              ))}
            </ScrollView>
          </View>
        ) : (
          // GRID MODE
          <ScrollView contentContainerStyle={styles.gridScroll}>
            <View style={styles.grid}>
              {cameraTiles.map((tile: any) => (
                <View key={tile.tileId} style={styles.gridItem}>
                  <RNChimeVideoView
                    tileId={tile.tileId}
                    zOrder={0}
                    style={StyleSheet.absoluteFillObject}
                  />
                </View>
              ))}
              {/* Show avatars for participants without video */}
              {connectedParticipants
                .filter(
                  (p: any) =>
                    !cameraTiles.find((t: any) => t.boundAttendeeId === p.attendeeId)
                )
                .map((p: any) => (
                  <View key={p.email} style={styles.gridItem}>
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarText}>
                        {p.name ? p.name.charAt(0).toUpperCase() : "?"}
                      </Text>
                    </View>
                  </View>
                ))}
            </View>
          </ScrollView>
        )}
      </View>

      {/* Local PIP */}
      {isLocalCameraOn && (
        <View style={styles.localPip}>
          <RNChimeVideoView
            tileId={localTileId}
            zOrder={1}
            style={StyleSheet.absoluteFillObject}
          />
        </View>
      )}

      {/* Controls */}
      <View style={styles.controlsBar}>
        <TouchableOpacity
          style={[styles.controlBtn, !isCameraOn && styles.controlBtnOff]}
          onPress={handleToggleCamera}
        >
          <Icon name={isCameraOn ? "video" : "video-off"} size={28} color="white" />
        </TouchableOpacity>

        {isCameraOn && (
          <TouchableOpacity style={styles.controlBtn} onPress={switchCamera}>
            <Icon name="camera-flip" size={28} color="white" />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.controlBtn, !isMicOn && styles.controlBtnOff]}
          onPress={handleToggleMic}
        >
          <Icon name={isMicOn ? "microphone" : "microphone-off"} size={28} color="white" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlBtn, !useSpeaker && styles.controlBtnOff]}
          onPress={handleSwitchAudio}
        >
          <Icon
            name={useSpeaker ? "volume-high" : "volume-off"}
            size={28}
            color="white"
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.endCallBtn} onPress={endCall}>
          <Icon name="phone-hangup" size={28} color="white" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  fullContainer: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    zIndex: 10,
  },
  headerTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  videoGridContainer: {
    flex: 1,
  },
  gridScroll: {
    flexGrow: 1,
    justifyContent: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    padding: 2,
  },
  gridItem: {
    width: "48%",
    aspectRatio: 3 / 4,
    margin: "1%",
    backgroundColor: "#333",
    borderRadius: 8,
    overflow: "hidden",
  },
  avatarPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "white",
    fontSize: 32,
    fontWeight: "bold",
  },
  contentShareLayout: {
    flex: 1,
  },
  contentShareMain: {
    flex: 4,
    backgroundColor: "black",
  },
  contentLabel: {
    position: "absolute",
    top: 10,
    left: 10,
    color: "white",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    zIndex: 10,
  },
  contentShareRoster: {
    flex: 1,
    flexDirection: "row",
    padding: 8,
  },
  miniTile: {
    width: 80,
    height: 120,
    backgroundColor: "#333",
    marginRight: 8,
    borderRadius: 8,
    overflow: "hidden",
  },
  localPip: {
    position: "absolute",
    right: 20,
    bottom: 100,
    width: 90,
    height: 140,
    backgroundColor: "#333",
    borderRadius: 12,
    overflow: "hidden",
    elevation: 5,
    zIndex: 100,
  },
  controlsBar: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
    paddingVertical: 20,
    backgroundColor: "rgba(0,0,0,0.8)",
  },
  controlBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#444",
    justifyContent: "center",
    alignItems: "center",
  },
  controlBtnOff: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  endCallBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#ff3b30",
    justifyContent: "center",
    alignItems: "center",
  },
  minimizedContainer: {
    position: "absolute",
    right: 20,
    bottom: 100,
    width: 120,
    height: 180,
    borderRadius: 16,
    backgroundColor: "#333",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    zIndex: 999,
  },
  minimizedContent: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  minimizedAvatarContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  endCallMiniBtn: {
    position: "absolute",
    top: -10,
    right: -10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#ff3b30",
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    zIndex: 1000,
  },
});

export default GroupCallOverlay;
