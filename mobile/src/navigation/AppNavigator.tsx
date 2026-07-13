import React from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/useAuthStore';

// Screens
import LoginScreen from '../screens/LoginScreen';
import BabiesListScreen from '../screens/BabiesListScreen';
import BabyDetailsScreen from '../screens/BabyDetailsScreen';
import AddBabyScreen from '../screens/AddBabyScreen';
import SampleFormScreen from '../screens/SampleFormScreen';
import FaceScanScreen from '../screens/FaceScanScreen';
import { FaceScanResult } from '../services/faceService';

export type RootStackParamList = {
  Login: undefined;
  BabiesList: undefined;
  BabyDetails: { babyId: string };
  AddBaby: { babyId?: string; prefilledImageUri?: string; prefilledFaceScan?: FaceScanResult } | undefined;
  SampleForm: { babyId: string; sampleId?: string }; // if sampleId exists, edit mode
  FaceScan: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export default function AppNavigator() {
  const { token, isLoading } = useAuthStore();

  if (isLoading) {
    return null; // Could show a splash screen here
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {token == null ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="BabiesList" component={BabiesListScreen} />
            <Stack.Screen name="BabyDetails" component={BabyDetailsScreen} />
            <Stack.Screen name="AddBaby" component={AddBabyScreen} />
            <Stack.Screen name="SampleForm" component={SampleFormScreen} />
            <Stack.Screen name="FaceScan" component={FaceScanScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
