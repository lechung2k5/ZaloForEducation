import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Colors } from "../../constants/Theme";
import { useAuth } from "../../context/AuthContext";

interface PollOption {
  text: string;
  votes: number;
  voters: string[];
}

interface PollMessageProps {
  messageId: string;
  topic: string;
  options: string[];
  votes?: Record<string, string>; // voterEmail -> optionIndex
  senderEmail?: string;
  onVote?: (optionIndex: number) => Promise<void>;
  onClosePoll?: () => Promise<void>;
  isClosed?: boolean;
}

const PollMessage: React.FC<PollMessageProps> = ({
  messageId,
  topic,
  options,
  votes = {},
  senderEmail,
  onVote,
  onClosePoll,
  isClosed = false,
}) => {
  const { user } = useAuth();
  const [draftOption, setDraftOption] = useState<number | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const normalizedUserEmail = String(user?.email || "")
    .trim()
    .toLowerCase();

  // Find user's current vote
  const votedOptionByCurrentUser = useMemo(() => {
    const entries = Object.entries(votes || {});
    const found = entries.find(
      ([email]) =>
        String(email || "")
          .trim()
          .toLowerCase() === normalizedUserEmail,
    );
    if (!found) return null;
    const parsed = Number.parseInt(String(found[1]), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }, [votes, normalizedUserEmail]);

  // Transform options with vote counts
  const pollOptions = useMemo<PollOption[]>(() => {
    return options.map((text, idx) => {
      const votersForThis = Object.entries(votes || {})
        .filter(([_, optIdx]) => Number.parseInt(String(optIdx), 10) === idx)
        .map(([voterId]) => voterId);

      return {
        text,
        votes: votersForThis.length,
        voters: votersForThis,
      };
    });
  }, [options, votes]);

  const handleVote = async (optionIndex: number) => {
    if (isVoting || !onVote || isClosed) return;

    setIsVoting(true);
    try {
      await onVote(optionIndex);
      setDraftOption(null);
    } catch (error) {
      console.error("Failed to vote:", error);
    } finally {
      setIsVoting(false);
    }
  };

  const handleClosePoll = async () => {
    if (isClosing || !onClosePoll) return;
    setIsClosing(true);
    try {
      await onClosePoll();
    } catch (error) {
      console.error("Failed to close poll:", error);
    } finally {
      setIsClosing(false);
    }
  };

  const totalVotes = pollOptions.reduce((sum, opt) => sum + opt.votes, 0);
  const selectedOptionIndex = draftOption ?? votedOptionByCurrentUser;
  const canSubmit = draftOption !== null;
  const hasVoted = votedOptionByCurrentUser !== null;
  const isCreator =
    String(senderEmail || "")
      .trim()
      .toLowerCase() === normalizedUserEmail;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.label}>Chọn một phương án</Text>
          <Text style={styles.title}>{topic}</Text>
        </View>
        {isClosed && (
          <View style={styles.closedBadge}>
            <Text style={styles.closedIcon}>lock</Text>
            <Text style={styles.closedText}>Đã đóng</Text>
          </View>
        )}
      </View>

      {/* Options */}
      <View style={styles.optionsContainer}>
        {pollOptions.map((option, index) => {
          const isSelected = selectedOptionIndex === index;
          const optionVotes = option.votes;
          const totalVotesCount = totalVotes || 1;
          const percentage =
            totalVotesCount > 0
              ? Math.round((optionVotes / totalVotesCount) * 100)
              : 0;

          return (
            <Pressable
              key={index}
              onPress={() => {
                if (isClosed || isVoting) return;
                setDraftOption(index);
              }}
              disabled={isVoting || isClosed}
              style={({ pressed }) => [
                styles.option,
                isSelected && styles.optionSelected,
                (isClosed || isVoting) && styles.optionDisabled,
              ]}
            >
              {/* Vote Progress Bar */}
              <View
                style={[
                  styles.progressBar,
                  {
                    width: `${percentage}%`,
                  },
                  isSelected && styles.progressBarSelected,
                ]}
              />

              {/* Option Content */}
              <View style={styles.optionContent}>
                <View style={styles.optionLeft}>
                  <View
                    style={[
                      styles.checkbox,
                      isSelected && styles.checkboxSelected,
                    ]}
                  >
                    {isSelected && <Text style={styles.checkIcon}>✓</Text>}
                  </View>
                  <Text
                    style={[
                      styles.optionText,
                      isSelected && styles.optionTextSelected,
                    ]}
                    numberOfLines={2}
                  >
                    {option.text}
                  </Text>
                </View>

                <View style={styles.optionRight}>
                  <Text
                    style={[
                      styles.voteCount,
                      isSelected && styles.voteCountSelected,
                    ]}
                  >
                    {optionVotes}
                  </Text>
                  {option.voters.includes(user?.email || "") && (
                    <View style={styles.votedBadge}>
                      <Text style={styles.votedBadgeText}>Bạn</Text>
                    </View>
                  )}
                  {isSelected && draftOption !== null && (
                    <View style={styles.selectedBadge}>
                      <Text style={styles.selectedBadgeText}>Đã chọn</Text>
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Stats */}
      <View style={styles.stats}>
        <Text style={styles.statsText}>{totalVotes} phiếu</Text>
      </View>

      {/* Action Buttons */}
      {!isClosed && (
        <View style={styles.actions}>
          {hasVoted ? (
            <>
              <Pressable
                onPress={() => {
                  if (
                    draftOption !== null &&
                    draftOption !== votedOptionByCurrentUser
                  ) {
                    void handleVote(draftOption);
                  }
                }}
                disabled={
                  !canSubmit ||
                  isVoting ||
                  draftOption === votedOptionByCurrentUser
                }
                style={({ pressed }) => [
                  styles.buttonSecondary,
                  (isVoting || draftOption === votedOptionByCurrentUser) &&
                    styles.buttonDisabled,
                ]}
              >
                <Text style={styles.buttonSecondaryText}>
                  {isVoting ? "Đang gửi..." : "Đổi lựa chọn"}
                </Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              onPress={() => {
                if (draftOption !== null) {
                  void handleVote(draftOption);
                }
              }}
              disabled={!canSubmit || isVoting}
              style={({ pressed }) => [
                styles.buttonPrimary,
                (!canSubmit || isVoting) && styles.buttonDisabled,
              ]}
            >
              {isVoting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.buttonPrimaryText}>Bình chọn</Text>
              )}
            </Pressable>
          )}

          {isCreator && (
            <Pressable
              onPress={() => void handleClosePoll()}
              disabled={isClosing}
              style={({ pressed }) => [
                styles.closeButton,
                isClosing && styles.buttonDisabled,
              ]}
            >
              {isClosing ? (
                <ActivityIndicator color="#ef4444" size="small" />
              ) : (
                <Text style={styles.closeButtonIcon}>✕</Text>
              )}
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dde1ea",
    overflow: "hidden",
    maxWidth: 320,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 8,
  },
  headerContent: {
    flex: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1e293b",
    lineHeight: 18,
  },
  closedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#fee2e2",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  closedIcon: {
    fontSize: 11,
    color: "#dc2626",
    fontWeight: "600",
  },
  closedText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#dc2626",
  },
  optionsContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  option: {
    position: "relative",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#dde1ea",
    backgroundColor: "#f4f6fa",
    overflow: "hidden",
    minHeight: 44,
  },
  optionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + "10",
  },
  optionDisabled: {
    opacity: 0.7,
  },
  progressBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: Colors.primary + "20",
  },
  progressBarSelected: {
    backgroundColor: Colors.primary + "30",
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  optionLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  optionRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#cbd5e1",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  checkboxSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkIcon: {
    fontSize: 12,
    color: "#fff",
    fontWeight: "700",
  },
  optionText: {
    fontSize: 13,
    color: "#1e293b",
    fontWeight: "500",
    flex: 1,
  },
  optionTextSelected: {
    fontWeight: "600",
    color: "#1e293b",
  },
  voteCount: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
  },
  voteCountSelected: {
    color: Colors.primary,
    fontWeight: "700",
  },
  votedBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  votedBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#fff",
  },
  selectedBadge: {
    marginLeft: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: Colors.primary,
  },
  selectedBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#fff",
  },
  stats: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  statsText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
  },
  actions: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingBottom: 12,
  },
  buttonPrimary: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonSecondary: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonPrimaryText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  buttonSecondaryText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.primary,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#fee2e2",
    borderWidth: 1,
    borderColor: "#fecaca",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  closeButtonIcon: {
    fontSize: 16,
    color: "#ef4444",
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

export default PollMessage;
