import React from 'react';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { FeatureDetail } from './FeatureDetail';
import { RootStackParamList } from '@navigation/AppNavigator';
import { VoiceButton } from '@components/index';
import { View, StyleSheet } from 'react-native';

export type FeatureScreenRouteProp = RouteProp<RootStackParamList, 'Feature'>;

export const FeatureScreen: React.FC = () => {
  const route = useRoute<FeatureScreenRouteProp>();
  const navigation = useNavigation();
  const { feature, role } = route.params;

  return (
    <View style={styles.container}>
      <FeatureDetail feature={feature} role={role} />
      <VoiceButton
        label="Go back"
        onPress={() => navigation.goBack()}
        accessibilityHint="Return to dashboard"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
