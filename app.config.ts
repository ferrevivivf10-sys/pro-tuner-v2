import type { ExpoConfig } from "expo/config";
// Versao automatica: +1 a cada commit (ver scripts/version.js)
const { getVersion } = require("./scripts/version");
const appVersion = getVersion();
const bundleId = "com.app.protunermobile";
const env = {
  appName: "Pro Tuner",
  appSlug: "pro-tuner-mobile",
  scheme: "protuner",
  iosBundleId: bundleId,
  androidPackage: bundleId,
};
const config: ExpoConfig = {
  name: env.appName,
  slug: env.appSlug,
  version: appVersion.name,
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: env.scheme,
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: false,
    bundleIdentifier: env.iosBundleId,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#000000",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: env.androidPackage,
    versionCode: appVersion.code,
    permissions: ["RECORD_AUDIO"],
    // Permissoes que a lib de audio adiciona e o app nao usa
    blockedPermissions: [
      "android.permission.BLUETOOTH",
      "android.permission.BLUETOOTH_ADMIN",
      "android.permission.BLUETOOTH_CONNECT",
      "android.permission.USB_PERMISSION",
    ],
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-asset",
    [
      "@siteed/audio-studio",
      {
        // Sem gravacao em segundo plano, notificacao ou leitura de chamadas
        enableBackgroundAudio: false,
        enableNotifications: false,
        enablePhoneStateHandling: false,
        iosConfig: {
          microphoneUsageDescription:
            "O Pro Tuner usa o microfone para detectar a afinação.",
        },
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#000000",
        dark: {
          backgroundColor: "#000000",
        },
      },
    ],
    [
      "expo-build-properties",
      {
        android: {
          buildArchs: ["armeabi-v7a", "arm64-v8a"],
          minSdkVersion: 24,
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    commit: appVersion.commit,
    eas: {
      projectId: "f762a2b1-15a7-4b83-80db-95c49d8dd110",
    },
  },
};
export default config;
