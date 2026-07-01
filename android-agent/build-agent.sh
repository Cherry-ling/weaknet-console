#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENDORED_ROOT="$(cd "$ROOT_DIR/.." && pwd)/third_party/jdk"

find_unity_android_sdk() {
  local candidate
  for candidate in "/c/Program Files/Unity/Hub/Editor"/*/Editor/Data/PlaybackEngines/AndroidPlayer/SDK; do
    if [[ -d "$candidate" ]]; then
      printf '%s' "$candidate"
      return 0
    fi
  done
  return 1
}

resolve_build_tool() {
  local base_dir="$1"
  local tool_name="$2"
  local candidate
  for candidate in \
    "$base_dir/$tool_name$TOOL_SUFFIX" \
    "$base_dir/$tool_name.exe" \
    "$base_dir/$tool_name.bat" \
    "$base_dir/$tool_name"; do
    if [[ -e "$candidate" ]]; then
      printf '%s' "$candidate"
      return 0
    fi
  done
  printf '%s' "$base_dir/$tool_name$TOOL_SUFFIX"
  return 0
}

native_path() {
  local value="$1"
  if [[ "${OS:-}" == "Windows_NT" ]]; then
    cygpath -w "$value"
  else
    printf '%s' "$value"
  fi
}

if [[ "${OS:-}" == "Windows_NT" ]]; then
  USER_HOME="$(cygpath "$USERPROFILE" 2>/dev/null || printf '%s' "$HOME")"
  DEFAULT_SDK_DIR="$USER_HOME/AppData/Local/Android/Sdk"
  if ! find "$DEFAULT_SDK_DIR/build-tools" -mindepth 1 -maxdepth 2 -name 'd8*' 2>/dev/null | grep -q .; then
    UNITY_SDK_DIR="$(find_unity_android_sdk || true)"
    if [[ -n "$UNITY_SDK_DIR" ]]; then
      DEFAULT_SDK_DIR="$UNITY_SDK_DIR"
    fi
  fi
  if [[ -d "$VENDORED_ROOT/win-x64" ]]; then
    DEFAULT_JBR_DIR="$VENDORED_ROOT/win-x64"
  elif [[ -d "/c/Program Files/Java/latest" ]]; then
    DEFAULT_JBR_DIR="/c/Program Files/Java/latest"
  elif [[ -d "/c/Program Files/Java/jdk-26.0.1" ]]; then
    DEFAULT_JBR_DIR="/c/Program Files/Java/jdk-26.0.1"
  elif [[ -d "/c/Program Files/Unity/Hub/Editor/2022.3.62f1/Editor/Data/PlaybackEngines/AndroidPlayer/OpenJDK" ]]; then
    DEFAULT_JBR_DIR="/c/Program Files/Unity/Hub/Editor/2022.3.62f1/Editor/Data/PlaybackEngines/AndroidPlayer/OpenJDK"
  elif [[ -d "/c/Program Files/Android/Android Studio/jbr" ]]; then
    DEFAULT_JBR_DIR="/c/Program Files/Android/Android Studio/jbr"
  elif [[ -d "/c/Program Files/Android/Android Studio/jbr/Contents/Home" ]]; then
    DEFAULT_JBR_DIR="/c/Program Files/Android/Android Studio/jbr/Contents/Home"
  else
    DEFAULT_JBR_DIR=""
  fi
  TOOL_SUFFIX=".exe"
else
  if [[ -d "$VENDORED_ROOT/macos" ]]; then
    DEFAULT_JBR_DIR="$VENDORED_ROOT/macos"
  else
    DEFAULT_JBR_DIR="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
  fi
  DEFAULT_SDK_DIR="$HOME/Library/Android/sdk"
  TOOL_SUFFIX=""
fi

SDK_DIR="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$DEFAULT_SDK_DIR}}"
JBR_DIR="${JBR_DIR:-$DEFAULT_JBR_DIR}"

JAVA_BIN="${JAVA_BIN:-$JBR_DIR/bin/java}"
JAVAC_BIN="${JAVAC_BIN:-$JBR_DIR/bin/javac}"
KEYTOOL_BIN="${KEYTOOL_BIN:-$JBR_DIR/bin/keytool}"
JAR_BIN="${JAR_BIN:-$JBR_DIR/bin/jar}"

export JAVA_HOME="${JAVA_HOME:-$JBR_DIR}"
export PATH="$JAVA_HOME/bin:$PATH"

if [[ -z "${ANDROID_JAR:-}" ]]; then
  ANDROID_JAR="$(find "$SDK_DIR/platforms" -path '*/android.jar' 2>/dev/null | sort | tail -n 1)"
fi
if [[ -z "${BUILD_TOOLS_DIR:-}" ]]; then
  BUILD_TOOLS_DIR="$(find "$SDK_DIR/build-tools" -maxdepth 1 -mindepth 1 -type d 2>/dev/null | sort | tail -n 1)"
fi
ANDROID_JAR="${ANDROID_JAR:-$SDK_DIR/platforms/android-36.1/android.jar}"
BUILD_TOOLS_DIR="${BUILD_TOOLS_DIR:-$SDK_DIR/build-tools/36.1.0}"
AAPT2="${AAPT2:-$(resolve_build_tool "$BUILD_TOOLS_DIR" "aapt2")}"
D8="${D8:-$(resolve_build_tool "$BUILD_TOOLS_DIR" "d8")}"
APKSIGNER="${APKSIGNER:-$(resolve_build_tool "$BUILD_TOOLS_DIR" "apksigner")}"
ZIPALIGN="${ZIPALIGN:-$(resolve_build_tool "$BUILD_TOOLS_DIR" "zipalign")}"

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

"$AAPT2" compile --dir "$(native_path "$ROOT_DIR/res")" -o "$(native_path "$BUILD_DIR/resources.zip")"
"$AAPT2" link \
  -I "$(native_path "$ANDROID_JAR")" \
  --manifest "$(native_path "$ROOT_DIR/AndroidManifest.xml")" \
  --java "$(native_path "$GEN_DIR")" \
  -o "$(native_path "$LINKED_APK")" \
  "$(native_path "$BUILD_DIR/resources.zip")"

if [[ "${OS:-}" == "Windows_NT" ]]; then
  while IFS= read -r source_file; do
    native_path "$source_file"
  done < <(find "$ROOT_DIR/src/main/java" "$GEN_DIR" -name '*.java' -print) > "$BUILD_DIR/sources.list"
else
  find "$ROOT_DIR/src/main/java" "$GEN_DIR" -name '*.java' -print > "$BUILD_DIR/sources.list"
fi
"$JAVAC_BIN" \
  -encoding UTF-8 \
  -source 8 \
  -target 8 \
  -bootclasspath "$(native_path "$ANDROID_JAR")" \
  -d "$(native_path "$CLASSES_DIR")" \
  @"$(native_path "$BUILD_DIR/sources.list")"

(cd "$CLASSES_DIR" && "$JAR_BIN" cf "$(native_path "$BUILD_DIR/classes.jar")" .)
"$D8" --min-api 23 --lib "$(native_path "$ANDROID_JAR")" --output "$(native_path "$DEX_DIR")" "$(native_path "$BUILD_DIR/classes.jar")"

cp "$LINKED_APK" "$UNSIGNED_APK"
(cd "$DEX_DIR" && "$JAR_BIN" uf "$(native_path "$UNSIGNED_APK")" classes.dex)

if [ -d "$ROOT_DIR/jniLibs" ]; then
  mkdir -p "$BUILD_DIR/apk-lib/lib"
  cp -R "$ROOT_DIR/jniLibs/"* "$BUILD_DIR/apk-lib/lib/"
  (cd "$BUILD_DIR/apk-lib" && "$JAR_BIN" uf "$(native_path "$UNSIGNED_APK")" lib)
fi

if [ ! -e "$KEYSTORE" ]; then
  "$KEYTOOL_BIN" -genkeypair \
    -keystore "$(native_path "$KEYSTORE")" \
    -storepass android \
    -keypass android \
    -alias weaknet-debug \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -dname "CN=Weaknet Agent Debug,O=Weaknet Console,C=CN" >/dev/null
fi

"$ZIPALIGN" -f 4 "$(native_path "$UNSIGNED_APK")" "$(native_path "$ALIGNED_APK")"
"$APKSIGNER" sign \
  --ks "$(native_path "$KEYSTORE")" \
  --ks-pass pass:android \
  --key-pass pass:android \
  --ks-key-alias weaknet-debug \
  --out "$(native_path "$SIGNED_APK")" \
  "$(native_path "$ALIGNED_APK")"
"$APKSIGNER" verify "$(native_path "$SIGNED_APK")"

echo "$SIGNED_APK"
