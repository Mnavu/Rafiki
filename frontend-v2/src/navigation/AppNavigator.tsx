import React, { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RoleSelectionScreen } from '@screens/auth/RoleSelectionScreen';
import { LoginScreen } from '@screens/auth/LoginScreen';
import { RoleDashboardScreen } from '@screens/dashboard/RoleDashboardScreen';
import { RoleFeatureScreen } from '@screens/feature/RoleFeatureScreen';
import { StudentHomeScreen } from '@screens/student/StudentHomeScreen';
import { StudentChatbotScreen } from '@screens/student/StudentChatbotScreen';
import { StudentAssignmentsScreen } from '@screens/student/StudentAssignmentsScreen';
import { StudentClassCallsScreen } from '@screens/student/StudentClassCallsScreen';
import { StudentScheduleScreen } from '@screens/student/StudentScheduleScreen';
import { ParentHomeScreen } from '@screens/parent/ParentHomeScreen';
import { FinanceControlCenterScreen } from '@screens/finance/FinanceControlCenterScreen';
import { MessageThreadListScreen } from '@screens/messages/MessageThreadListScreen';
import { MessageThreadDetailScreen } from '@screens/messages/MessageThreadDetailScreen';
import { StudentPeerDirectoryScreen } from '@screens/messages/StudentPeerDirectoryScreen';
import { ClassCommunityDetailScreen } from '@screens/messages/ClassCommunityDetailScreen';
import { LecturerClassesScreen } from '@screens/lecturer/LecturerClassesScreen';
import { LecturerClassDetailScreen } from '@screens/lecturer/LecturerClassDetailScreen';
import { LecturerAssignmentsScreen } from '@screens/lecturer/LecturerAssignmentsScreen';
import { LecturerPlannerScreen } from '@screens/lecturer/LecturerPlannerScreen';
import { VideoRoomScreen } from '@screens/lecturer/VideoRoomScreen';
import { RecordsControlCenterScreen } from '@screens/records/RecordsControlCenterScreen';
import { AdminControlCenterScreen } from '@screens/admin/AdminControlCenterScreen';
import { AdminPortalOnlyNoticeScreen } from '@screens/admin/AdminPortalOnlyNoticeScreen';
import { DjangoAdminGatewayScreen } from '@screens/admin/DjangoAdminGatewayScreen';
import { WebOnlyAdminNoticeScreen } from '@screens/admin/WebOnlyAdminNoticeScreen';
import { ProfileSettingsScreen } from '@screens/settings/ProfileSettingsScreen';
import { useAuth } from '@context/AuthContext';
import type { Role } from '@app-types/roles';
import type { FeatureDescriptor } from '@data/featureCatalog';
import { logClientActivitySafe } from '@services/api';

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
  LecturerAssignments: { unitId?: number; unitTitle?: string } | undefined;
  LecturerPlanner: { unitId: number; unitTitle?: string };
  VideoRoom: { meetingUrl: string; title?: string };
  RecordsControlCenter: undefined;
  AdminControlCenter: undefined;
  DjangoAdminGateway: undefined;
  AdminPortalOnlyNotice: undefined;
  WebOnlyAdminNotice: undefined;
  ProfileSettings: undefined;
  StudentHome:
    | {
        targetSection?:
          | 'search'
          | 'overview'
          | 'unit_registration'
          | 'timetable'
          | 'assignments'
          | 'class_calls'
          | 'class_communities'
          | 'finance'
          | 'communication';
      }
    | undefined;
  StudentChatbot: undefined;
  StudentAssignments: undefined;
  StudentClassCalls: undefined;
  StudentSchedule: undefined;
  ParentHome: undefined;
  FinanceControlCenter: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator = () => {
  const { isAuthenticated, state } = useAuth();
  const navigationRef = useRef(createNavigationContainerRef<RootStackParamList>()).current;
  const lastTrackedRouteKey = useRef<string | null>(null);
  const isAdminWebPortal =
    Platform.OS === 'web' && (process.env.EXPO_PUBLIC_WEB_PORTAL ?? '').trim().toLowerCase() === 'admin';
  const isWebAdminUser =
    (state.user?.role === 'admin' || state.user?.role === 'superadmin') && Platform.OS === 'web';
  const isNativeAdminUser =
    (state.user?.role === 'admin' || state.user?.role === 'superadmin') && Platform.OS !== 'web';
  const shouldRestrictToAdminPortal =
    isAdminWebPortal &&
    !!state.user &&
    state.user.role !== 'admin' &&
    state.user.role !== 'superadmin';

  const trackCurrentRoute = useCallback(() => {
    if (!state.accessToken || !state.user || !navigationRef.isReady()) {
      return;
    }
    const currentRoute = navigationRef.getCurrentRoute();
    if (!currentRoute || lastTrackedRouteKey.current === currentRoute.key) {
      return;
    }
    lastTrackedRouteKey.current = currentRoute.key;
    const routeParams = (currentRoute.params as { targetSection?: string } | undefined) ?? undefined;
    void logClientActivitySafe(state.accessToken, {
      eventType: 'page_open',
      label: currentRoute.name,
      screen: currentRoute.name,
      component: 'NavigationContainer',
      target: currentRoute.name,
      metadata: routeParams?.targetSection ? { targetSection: routeParams.targetSection } : undefined,
    });
  }, [navigationRef, state.accessToken, state.user]);

  useEffect(() => {
    if (!state.accessToken) {
      lastTrackedRouteKey.current = null;
    }
  }, [state.accessToken]);

  return (
    <NavigationContainer ref={navigationRef} onReady={trackCurrentRoute} onStateChange={trackCurrentRoute}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated && state.user ? (
          <>
            {shouldRestrictToAdminPortal ? (
              <Stack.Screen name="AdminPortalOnlyNotice" component={AdminPortalOnlyNoticeScreen} />
            ) : (
              <>
                {state.user.role === 'student' ? (
                  <Stack.Screen name="StudentHome" component={StudentHomeScreen} />
                ) : null}
                {state.user.role === 'parent' ? (
                  <Stack.Screen name="ParentHome" component={ParentHomeScreen} />
                ) : null}
                {state.user.role === 'finance' ? (
                  <Stack.Screen name="FinanceControlCenter" component={FinanceControlCenterScreen} />
                ) : null}
                {isWebAdminUser ? (
                  <Stack.Screen name="DjangoAdminGateway" component={DjangoAdminGatewayScreen} />
                ) : null}
                {isNativeAdminUser ? (
                  <Stack.Screen name="WebOnlyAdminNotice" component={WebOnlyAdminNoticeScreen} />
                ) : null}
                {state.user.role !== 'student' &&
                state.user.role !== 'parent' &&
                state.user.role !== 'finance' &&
                state.user.role !== 'admin' &&
                state.user.role !== 'superadmin' ? (
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
                <Stack.Screen name="LecturerAssignments" component={LecturerAssignmentsScreen} />
                <Stack.Screen name="LecturerPlanner" component={LecturerPlannerScreen} />
                <Stack.Screen name="VideoRoom" component={VideoRoomScreen} />
                <Stack.Screen name="RecordsControlCenter" component={RecordsControlCenterScreen} />
                <Stack.Screen name="AdminControlCenter" component={AdminControlCenterScreen} />
                <Stack.Screen name="ProfileSettings" component={ProfileSettingsScreen} />
                <Stack.Screen name="StudentChatbot" component={StudentChatbotScreen} />
                <Stack.Screen name="StudentAssignments" component={StudentAssignmentsScreen} />
                <Stack.Screen name="StudentClassCalls" component={StudentClassCallsScreen} />
                <Stack.Screen name="StudentSchedule" component={StudentScheduleScreen} />
              </>
            )}
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
