import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
import SoundService from "../../utils/SoundService";
import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";

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
    attendeeData,
    meetingData,
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
  const [isCameraOn, setIsCameraOn] = useState(callType === 'video');
  const [useSpeaker, setUseSpeaker] = useState(true);

  useEffect(() => {
    if (callId) {
      setIsCameraOn(callType === 'video');
      setIsMicOn(true);
    }
  }, [callId, callType]);

  useEffect(() => {
    if (meetingData && attendeeData) {
      setupSession(meetingData, attendeeData);
    }
  }, [meetingData, attendeeData, setupSession]);

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
    SoundService.playHangupSound();
    try {
      if (SocketService.socket && convId && callId) {
        (SocketService.socket as any).emit("group-call:hangup", {
          convId,
          callId,
          userEmail: user?.email,
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

  const availableStreams = useMemo(() => {
    let items: any[] = [];
    
    // 1. Add all active video tiles (except content)
    videoTiles.forEach((tile: any) => {
      if (tile.isContent) return;
      const attendeeId = (tile.boundAttendeeId || "").toLowerCase();
      const isLocal = tile.isLocal || tile.tileId === localTileId;
      const p = participants[attendeeId];

      items.push({
        id: isLocal ? 'local-camera' : `remote-camera-${attendeeId || tile.tileId}`,
        attendeeId,
        email: p?.email || (isLocal ? user?.email : 'unknown'),
        name: isLocal ? 'Bạn' : (p?.name || p?.fullName || null),
        avatar: p?.avatar || p?.avatarUrl || (isLocal ? user?.avatarUrl : null),
        tileId: tile.tileId,
        isVideoActive: true,
        isLocal: isLocal,
        isContent: false,
      });
    });

    // 2. Add connected participants who DON'T have a video tile
    Object.entries(participants || {}).forEach(([id, p]: [string, any]) => {
      if (!id || !p) return;
      if (p.status !== 'connected') return;
      
      const attendeeId = id.toLowerCase();
      const hasTile = videoTiles.some((t: any) => t.boundAttendeeId && t.boundAttendeeId.toLowerCase() === attendeeId && !t.isContent);
      
      if (!hasTile) {
        const isLocal = attendeeId === (attendeeData?.AttendeeId || "").toLowerCase();
        items.push({
          id: isLocal ? 'local-camera' : `remote-camera-${attendeeId}`,
          attendeeId: attendeeId,
          email: p?.email,
          name: isLocal ? 'Bạn' : (p?.name || p?.fullName),
          avatar: p?.avatar || p?.avatarUrl,
          tileId: isLocal ? localTileId : null,
          isVideoActive: isLocal ? (localTileId !== null && isCameraOn) : false,
          isLocal: isLocal,
          isContent: false,
        });
      }
    });

    // 3. Local user fallback if no tile and not in participants
    const localId = (attendeeData?.AttendeeId || "").toLowerCase();
    if (localId && !items.find(i => i.isLocal)) {
      items.push({
        id: 'local-camera',
        attendeeId: localId,
        email: user?.email || 'unknown',
        name: 'Bạn',
        avatar: user?.avatarUrl || null,
        tileId: localTileId,
        isVideoActive: localTileId !== null && isCameraOn,
        isLocal: true,
        isContent: false,
      });
    }

    return items;
  }, [participants, videoTiles, localTileId, attendeeData?.AttendeeId, isCameraOn, user]);

  const contentTile = videoTiles.find((t: any) => t.isContent);
  const isLocalCameraOn = isCameraOn && localTileId !== null;

  if (callState === "IDLE") return null;

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
                style={[StyleSheet.absoluteFillObject, { backgroundColor: "transparent" }]}
              />
              <Text style={styles.contentLabel}>Màn hình được chia sẻ</Text>
            </View>
            <ScrollView horizontal style={styles.contentShareRoster}>
              {availableStreams.map((stream: any) => (
                <View key={stream.id} style={styles.miniTile}>
                  {stream.isVideoActive && stream.tileId !== null ? (
                    <RNChimeVideoView
                      tileId={stream.tileId}
                      zOrder={1}
                      style={[StyleSheet.absoluteFillObject, { backgroundColor: "transparent" }]}
                    />
                  ) : (
                    <View style={[styles.avatarPlaceholder, { backgroundColor: '#222' }]}>
                       <Text style={{color: 'white'}}>{(stream.name || stream.email || "?").charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={styles.nameOverlay}>
                    <Text style={styles.nameText} numberOfLines={1}>{stream.name || stream.email || "Unknown"}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        ) : (
          // GRID MODE
          <ScrollView contentContainerStyle={styles.gridScroll}>
            <View style={styles.grid}>
              {availableStreams.map((stream: any) => {
                const gridStyle = availableStreams.length === 1 ? styles.gridItemFull : 
                                  availableStreams.length === 2 ? styles.gridItemHalf : 
                                  styles.gridItemQuarter;
                return (
                  <View key={stream.id} style={[styles.gridItem, gridStyle]}>
                    {stream.isVideoActive && stream.tileId !== null ? (
                      <RNChimeVideoView
                        tileId={stream.tileId}
                        style={[StyleSheet.absoluteFillObject, { backgroundColor: "transparent" }]}
                      />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        {stream.avatar ? (
                          <Image source={{ uri: stream.avatar }} style={styles.avatarImage} />
                        ) : (
                          <Text style={styles.avatarText}>
                            {(stream.name || stream.email || "?").charAt(0).toUpperCase()}
                          </Text>
                        )}
                      </View>
                    )}
                    <View style={styles.nameOverlay}>
                      <Text style={styles.nameText} numberOfLines={1}>{stream.name || stream.email || "Unknown"}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}
      </View>

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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#1a1a1a",
    zIndex: 1000,
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
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    padding: 2,
  },
  gridItem: {
    backgroundColor: "transparent",
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
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  nameOverlay: {
    position: "absolute",
    bottom: 8,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    maxWidth: "80%",
  },
  nameText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
  gridItemFull: {
    width: SCREEN_WIDTH - 20,
    height: SCREEN_HEIGHT * 0.7,
    margin: 10,
  },
  gridItemHalf: {
    width: SCREEN_WIDTH - 20,
    height: (SCREEN_HEIGHT * 0.7) / 2 - 10,
    marginHorizontal: 10,
    marginVertical: 5,
  },
  gridItemQuarter: {
    width: (SCREEN_WIDTH - 30) / 2,
    height: ((SCREEN_WIDTH - 30) / 2) * (4 / 3),
    margin: 5,
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
