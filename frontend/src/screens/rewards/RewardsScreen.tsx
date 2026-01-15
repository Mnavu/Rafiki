import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, spacing, typography } from '@theme/index';
import { VoiceButton } from '@components/index';
import { useAuth } from '@context/AuthContext';
import { fetchStudentRewards, fetchRewardsLeaderboard, Merit, ApiStudent } from '@services/api';

const MAX_CLAIMS_PER_TERM = 3;
const REWARD_POINT_TARGET = 300;

type RewardTile = {
  id: string;
  title: string;
  subtitle: string;
  cost: number;
  image: string;
  type: 'merch' | 'fee' | 'badge' | 'experience';
};

const sampleRewards: RewardTile[] = [
  {
    id: 'hoodie',
    title: 'Limited Hoodie',
    subtitle: 'Showcase the campus pride',
    cost: 200,
    image:
      'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=400&q=60',
    type: 'merch',
  },
  {
    id: 'fee-credit',
    title: 'KES 1,000 Fee Credit',
    subtitle: 'Instant relief on next invoice',
    cost: 150,
    image:
      'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=400&q=60',
    type: 'fee',
  },
];

export const RewardsScreen: React.FC = () => {
  const { state: authState } = useAuth();
  const [selectedReward, setSelectedReward] = useState<RewardTile | null>(null);
  const [starBalance, setStarBalance] = useState(0);
  const [lifetimePoints, setLifetimePoints] = useState(0);
  const [termClaimsUsed] = useState(0);
  const [actionFeed, setActionFeed] = useState<Merit[]>([]);
  const [leaderboard, setLeaderboard] = useState<ApiStudent[]>([]);

  useEffect(() => {
    if (authState.accessToken && authState.user) {
      if (authState.user.role === 'student') {
        fetchStudentRewards(authState.accessToken, authState.user.id)
          .then((data) => {
            setStarBalance(data.stars);
            setLifetimePoints(data.stars); // Assuming lifetime points is the total stars
            setActionFeed(data.history);
          })
          .catch((err) => console.error('Failed to fetch student rewards:', err));
      }

      fetchRewardsLeaderboard(authState.accessToken)
        .then(setLeaderboard)
        .catch((err) => console.error('Failed to fetch leaderboard:', err));
    }
  }, [authState.accessToken, authState.user]);

  const streak = 5; // This will also come from the backend

  const tier = useMemo(() => {
    if (starBalance >= 450) {return 'Platinum';}
    if (starBalance >= 300) {return 'Gold';}
    if (starBalance >= 150) {return 'Silver';}
    return 'Bronze';
  }, [starBalance]);

  const progressPoints = lifetimePoints % REWARD_POINT_TARGET;
  const progressPercent = Math.min(Math.round((progressPoints / REWARD_POINT_TARGET) * 100), 100);
  const claimsRemaining = Math.max(MAX_CLAIMS_PER_TERM - termClaimsUsed, 0);

  const handleRewardClaim = useCallback(() => {
    if (!selectedReward) {return;}
    // TODO: Implement API call to claim a reward
    Alert.alert('Coming Soon!', 'Reward claiming functionality is not yet implemented.');
  }, [selectedReward]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.heroCard}>
        <View style={styles.heroText}>
          <Text style={styles.heroLabel}>Current Balance</Text>
          <Text style={styles.heroValue}>{starBalance} Stars</Text>
          <Text style={styles.heroTier}>Tier: {tier}</Text>
        </View>
        <View style={styles.heroBadge}>
          <Ionicons name="medal" size={42} color={palette.surface} />
          <Text style={styles.heroStreak}>{streak}-day streak</Text>
        </View>
      </View>

      <View style={styles.progressCard}>
        <Text style={styles.cardTitle}>Term reward tracker</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
        </View>
        <Text style={styles.progressMeta}>
          {progressPoints} / {REWARD_POINT_TARGET} pts toward the next slot
        </Text>
        <View style={styles.claimRow}>
          {Array.from({ length: MAX_CLAIMS_PER_TERM }).map((_, index) => (
            <View
              key={index}
              style={[styles.claimDot, index < termClaimsUsed ? styles.claimDotUsed : undefined]}
            />
          ))}
          <Text style={styles.claimText}>Claims left this term: {claimsRemaining}</Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Leaderboard</Text>
      </View>
      <View style={styles.feedCard}>
        {leaderboard.length === 0 ? (
          <Text style={styles.helperText}>Leaderboard is loading...</Text>
        ) : (
          leaderboard.map((student, index) => (
            <View key={student.user.id} style={styles.feedRow}>
              <Text style={styles.feedTitle}>{index + 1}. {student.user.display_name}</Text>
              <Text style={styles.feedPoints}>{student.stars} pts</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Featured Rewards</Text>
        <TouchableOpacity>
          <Text style={styles.sectionLink}>View all</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.rewardGrid}>
        {sampleRewards.map((reward) => (
          <TouchableOpacity
            key={reward.id}
            style={styles.rewardCard}
            onPress={() => setSelectedReward(reward)}
          >
            <Image source={{ uri: reward.image }} style={styles.rewardImage} />
            <View style={styles.rewardBody}>
              <Text style={styles.rewardTitle}>{reward.title}</Text>
              <Text style={styles.rewardSubtitle}>{reward.subtitle}</Text>
              <View style={styles.rewardFooter}>
                <Text style={styles.rewardCost}>{reward.cost} pts</Text>
                <Ionicons name="arrow-forward" size={18} color={palette.primary} />
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
      </View>
      <View style={styles.feedCard}>
        {actionFeed.length === 0 ? (
          <Text style={styles.helperText}>Your recent rewards will appear here.</Text>
        ) : (
          actionFeed.map((item) => (
            <View key={item.id} style={styles.feedRow}>
              <Text style={styles.feedTitle}>{item.reason}</Text>
              <Text style={styles.feedPoints}>+{item.stars} pts</Text>
            </View>
          ))
        )}
      </View>

      {selectedReward ? (
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Image source={{ uri: selectedReward.image }} style={styles.modalImage} />
            <Text style={styles.modalTitle}>{selectedReward.title}</Text>
            <Text style={styles.modalSubtitle}>{selectedReward.subtitle}</Text>
            <Text style={styles.modalCost}>{selectedReward.cost} Stars</Text>
            <View style={styles.modalActions}>
              <VoiceButton
                label="Claim"
                onPress={handleRewardClaim}
                accessibilityHint="Use an unlocked reward slot"
              />
              <VoiceButton label="Close" onPress={() => setSelectedReward(null)} />
            </View>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    backgroundColor: palette.background,
  },
  heroCard: {
    backgroundColor: palette.primary,
    borderRadius: 24,
    padding: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  heroText: {
    flex: 1,
  },
  heroLabel: {
    ...typography.helper,
    color: palette.surface,
  },
  heroValue: {
    ...typography.headingXL,
    color: palette.surface,
    marginTop: spacing.xs,
  },
  heroTier: {
    ...typography.body,
    color: palette.surface,
    opacity: 0.8,
    marginTop: spacing.xs,
  },
  heroBadge: {
    alignItems: 'center',
  },
  heroStreak: {
    ...typography.helper,
    color: palette.surface,
    marginTop: spacing.xs,
  },
  progressCard: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: spacing.lg,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 3,
    marginBottom: spacing.lg,
  },
  progressTrack: {
    width: '100%',
    height: 16,
    borderRadius: 999,
    backgroundColor: palette.disabled,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: palette.accent,
  },
  progressMeta: {
    ...typography.helper,
    color: palette.textSecondary,
  },
  claimRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  claimDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.primary,
  },
  claimDotUsed: {
    backgroundColor: palette.primary,
  },
  claimText: {
    ...typography.helper,
    color: palette.textSecondary,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.headingM,
    color: palette.textPrimary,
  },
  sectionLink: {
    ...typography.helper,
    color: palette.primary,
  },
  rewardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  rewardCard: {
    width: '48%',
    backgroundColor: palette.surface,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 4,
    marginBottom: spacing.md,
  },
  rewardImage: {
    width: '100%',
    height: 140,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  rewardBody: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  rewardTitle: {
    ...typography.headingM,
  },
  rewardSubtitle: {
    ...typography.helper,
    color: palette.textSecondary,
  },
  rewardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  rewardCost: {
    ...typography.helper,
    color: palette.primary,
  },
  feedCard: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: spacing.lg,
    gap: spacing.xs,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 3,
    marginBottom: spacing.lg,
  },
  feedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feedTitle: {
    ...typography.body,
    color: palette.textPrimary,
  },
  feedPoints: {
    ...typography.helper,
    color: palette.accent,
  },
  helperText: {
    ...typography.helper,
    color: palette.textSecondary,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 420,
    gap: spacing.sm,
  },
  modalImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
  },
  modalTitle: {
    ...typography.headingM,
    color: palette.textPrimary,
  },
  modalSubtitle: {
    ...typography.body,
    color: palette.textSecondary,
  },
  modalCost: {
    ...typography.headingM,
    color: palette.primary,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.md,
  },
});
