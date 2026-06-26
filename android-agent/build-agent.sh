#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
SDK_DIR="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
JBR_DIR="/Applications/Android Studio.app/Contents/jbr/Contents/Home"

JAVA_BIN="${JAVA_BIN:-$JBR_DIR/bin/java}"
JAVAC_BIN="${JAVAC_BIN:-$JBR_DIR/bin/javac}"
KEYTOOL_BIN="${KEYTOOL_BIN:-$JBR_DIR/bin/keytool}"
JAR_BIN="${JAR_BIN:-$JBR_DIR/bin/jar}"

export JAVA_HOME="${JAVA_HOME:-$JBR_DIR}"
export PATH="$JAVA_HOME/bin:$PATH"

ANDROID_JAR="${ANDROID_JAR:-$SDK_DIR/platforms/android-36.1/android.jar}"
BUILD_TOOLS_DIR="${BUILD_TOOLS_DIR:-$SDK_DIR/build-tools/36.1.0}"
AAPT2="${AAPT2:-$BUILD_TOOLS_DIR/aapt2}"
D8="${D8:-$BUILD_TOOLS_DIR/d8}"
APKSIGNER="${APKSIGNER:-$BUILD_TOOLS_DIR/apksigner}"
ZIPALIGN="${ZIPALIGN:-$BUILD_TOOLS_DIR/zipalign}"

BUILD_DIR="$ROOT_DIR/build"
DIST_DIR="$ROOT_DIR/dist"
CLASSES_DIR="$BUILD_DIR/classes"
DEX_DIR="$BUILD_DIR/dex"
GEN_DIR="$BUILD_DIR/generated"
LINKED_APK="$BUILD_DIR/linked.apk"
UNSIGNED_APK="$BUILD_DIR/weaknet-agent-unsigned.apk"
ALIGNED_APK="$BUILD_DIR/weaknet-agent-aligned.apk"
SIGNED_APK="$DIST_DIR/weaknet-agent-debug.apk"
KEYSTORE="$ROOT_DIR/debug.keystore"

for tool in "$JAVA_BIN" "$JAVAC_BIN" "$KEYTOOL_BIN" "$JAR_BIN" "$ANDROID_JAR" "$AAPT2" "$D8" "$APKSIGNER" "$ZIPALIGN"; do
  if [ ! -e "$tool" ]; then
    echo "Missing Android build dependency: $tool" >&2
    exit 1
  fi
done

rm -rf "$BUILD_DIR"
mkdir -p "$CLASSES_DIR" "$DEX_DIR" "$GEN_DIR" "$DIST_DIR"

"$AAPT2" compile --dir "$ROOT_DIR/res" -o "$BUILD_DIR/resources.zip"
"$AAPT2" link \
  -I "$ANDROID_JAR" \
  --manifest "$ROOT_DIR/AndroidManifest.xml" \
  --java "$GEN_DIR" \
  -o "$LINKED_APK" \
  "$BUILD_DIR/resources.zip"

find "$ROOT_DIR/src/main/java" "$GEN_DIR" -name '*.java' -print > "$BUILD_DIR/sources.list"
"$JAVAC_BIN" \
  -encoding UTF-8 \
  -source 8 \
  -target 8 \
  -bootclasspath "$ANDROID_JAR" \
  -d "$CLASSES_DIR" \
  @"$BUILD_DIR/sources.list"

(cd "$CLASSES_DIR" && "$JAR_BIN" cf "$BUILD_DIR/classes.jar" .)
"$D8" --min-api 23 --lib "$ANDROID_JAR" --output "$DEX_DIR" "$BUILD_DIR/classes.jar"

cp "$LINKED_APK" "$UNSIGNED_APK"
(cd "$DEX_DIR" && zip -q "$UNSIGNED_APK" classes.dex)

if [ -d "$ROOT_DIR/jniLibs" ]; then
  mkdir -p "$BUILD_DIR/apk-lib/lib"
  cp -R "$ROOT_DIR/jniLibs/"* "$BUILD_DIR/apk-lib/lib/"
  (cd "$BUILD_DIR/apk-lib" && zip -qr "$UNSIGNED_APK" lib)
fi

if [ ! -e "$KEYSTORE" ]; then
  "$KEYTOOL_BIN" -genkeypair \
    -keystore "$KEYSTORE" \
    -storepass android \
    -keypass android \
    -alias weaknet-debug \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -dname "CN=Weaknet Agent Debug,O=Weaknet Console,C=CN" >/dev/null
fi

"$ZIPALIGN" -f 4 "$UNSIGNED_APK" "$ALIGNED_APK"
"$APKSIGNER" sign \
  --ks "$KEYSTORE" \
  --ks-pass pass:android \
  --key-pass pass:android \
  --ks-key-alias weaknet-debug \
  --out "$SIGNED_APK" \
  "$ALIGNED_APK"
"$APKSIGNER" verify "$SIGNED_APK"

echo "$SIGNED_APK"
