#!/bin/bash
set -e

BUILD_ID="$1"

if [ -z "$BUILD_ID" ]; then
    echo "ERROR: build_id argument missing."
    exit 1
fi

echo "Preparing build folder: $BUILD_ID"

# 1. Ensure the source build folder exists
if [ ! -d "builds/$BUILD_ID" ]; then
    echo "ERROR: Folder builds/$BUILD_ID does not exist."
    exit 1
fi

# 2. Start clean workspace in 'app' directory
rm -rf app
mkdir app

# 3. Copy source into app/
cp -r builds/$BUILD_ID/* app/

cd app

# 4. Handle Dependencies
if [ -f package.json ]; then
    echo "Installing user project dependencies..."
    npm install
else
    echo "package.json missing — generating minimal project..."
    npm init -y
fi

# Ensure core Capacitor dependencies are present
npm install @capacitor/core @capacitor/cli @capacitor/android typescript

# 5. Initialize/Sync Capacitor Android
# Use 'add' if android folder doesn't exist, otherwise 'sync'
if [ ! -d "android" ]; then
    npx cap add android
else
    npx cap sync android
fi

# 6. Apply Fixes for Duplicate Classes & Java 21 Compatibility
echo "Applying Gradle fixes for duplicate classes..."

# Enable Jetifier in gradle.properties
PROPERTIES_FILE="android/gradle.properties"
if [ -f "$PROPERTIES_FILE" ]; then
    echo "android.useAndroidX=true" >> "$PROPERTIES_FILE"
    echo "android.enableJetifier=true" >> "$PROPERTIES_FILE"
fi

# Inject Resolution Strategy into app/build.gradle to force Kotlin versions
# This prevents the ':app:checkDebugDuplicateClasses' failure
BUILD_GRADLE="android/app/build.gradle"
if [ -f "$BUILD_GRADLE" ]; then
    # Use sed to insert the configuration before the dependencies block
    sed -i '/dependencies {/i \
configurations.all {\
    resolutionStrategy {\
        force "org.jetbrains.kotlin:kotlin-stdlib:1.9.23"\
        force "org.jetbrains.kotlin:kotlin-stdlib-jdk8:1.9.23"\
    }\
}' "$BUILD_GRADLE"
fi

echo "Capacitor Android project ready for Build ID: $BUILD_ID"