import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RoleSelectionScreen } from '@screens/auth/RoleSelectionScreen';
import { LoginScreen } from '@screens/auth/LoginScreen';
import { RoleDashboardScreen } from '@screens/dashboard/RoleDashboardScreen';
import { RoleFeatureScreen } from '@screens/feature/RoleFeatureScreen';
import { StudentHomeScreen } from '@screens/student/StudentHomeScreen';
import { StudentChatbotScreen } from '@screens/student/StudentChatbotScreen';
import { ParentHomeScreen } from '@screens/parent/ParentHomeScreen';
import { MessageThreadListScreen } from '@screens/messages/MessageThreadListScreen';
import { MessageThreadDetailScreen } from '@screens/messages/MessageThreadDetailScreen';
import { StudentPeerDirectoryScreen } from '@screens/messages/StudentPeerDirectoryScreen';
import { ClassCommunityDetailScreen } from '@screens/messages/ClassCommunityDetailScreen';
import { LecturerClassesScreen } from '@screens/lecturer/LecturerClassesScreen';
import { LecturerClassDetailScreen } from '@screens/lecturer/LecturerClassDetailScreen';
import { LecturerPlannerScreen } from '@screens/lecturer/LecturerPlannerScreen';
import { VideoRoomScreen } from '@screens/lecturer/VideoRoomScreen';
import { RecordsControlCenterScreen } from '@screens/records/RecordsControlCenterScreen';
import { AdminControlCenterScreen } from '@screens/admin/AdminControlCenterScreen';
import { useAuth } from '@context/AuthContext';
import type { Role } from '@app-types/roles';
import type { FeatureDescriptor } from '@data/featureCatalog';

export type RootStackParamList = {
  RoleSelection: undefined;
  Login: { role: Role };
  Dashboard: { role: Role };
  Feature: { role: Role; feature: FeatureDescriptor };
  MessageThreads: { role: Role };
  MessageThreadDetail: { role: Role; threadId: number; threadTitle?: string };
  StudentPeerDirectory: undefined;
  ClassCommunityDetail: { chatroomId: number; unitTitle: string; meetingUrl?: string };
  LecturerClasses: undefined;
  LecturerClassDetail: { unitId: number; unitTitle?: string };
  LecturerPlanner: { unitId: number; unitTitle?: string };
  VideoRoom: { meetingUrl: string; title?: string };
  RecordsControlCenter: undefined;
  AdminControlCenter: undefined;
  StudentHome: undefined;
  StudentChatbot: undefined;
  ParentHome: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator = () => {
  const { isAuthenticated, state } = useAuth();

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated && state.user ? (
          <>
            {state.user.role === 'student' ? (
              <Stack.Screen name="StudentHome" component={StudentHomeScreen} />
            ) : null}
            {state.user.role === 'parent' ? (
              <Stack.Screen name="ParentHome" component={ParentHomeScreen} />
            ) : null}
            {state.user.role !== 'student' && state.user.role !== 'parent' ? (
              <Stack.Screen
                name="Dashboard"
                component={RoleDashboardScreen}
                initialParams={{ role: state.user.role }}
              />
            ) : null}
            <Stack.Screen name="Feature" component={RoleFeatureScreen} />
            <Stack.Screen name="MessageThreads" component={MessageThreadListScreen} />
            <Stack.Screen name="MessageThreadDetail" component={MessageThreadDetailScreen} />
            <Stack.Screen name="StudentPeerDirectory" component={StudentPeerDirectoryScreen} />
            <Stack.Screen name="ClassCommunityDetail" component={ClassCommunityDetailScreen} />
            <Stack.Screen name="LecturerClasses" component={LecturerClassesScreen} />
            <Stack.Screen name="LecturerClassDetail" component={LecturerClassDetailScreen} />
            <Stack.Screen name="LecturerPlanner" component={LecturerPlannerScreen} />
            <Stack.Screen name="VideoRoom" component={VideoRoomScreen} />
            <Stack.Screen name="RecordsControlCenter" component={RecordsControlCenterScreen} />
            <Stack.Screen name="AdminControlCenter" component={AdminControlCenterScreen} />
            <Stack.Screen name="StudentChatbot" component={StudentChatbotScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
