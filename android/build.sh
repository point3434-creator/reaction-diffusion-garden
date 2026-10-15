#!/usr/bin/env bash
# Build the Android app with the classic toolchain, no Gradle: aapt + javac + dx + zipalign + apksigner.
#
# On Ubuntu 24.04:  sudo apt install aapt apksigner zipalign dalvik-exchange android-sdk-platform-23 default-jdk-headless python3-pil
#
# Signing: the app updates in place only when every build is signed with the same key, so keep your
# keystore somewhere safe and point the build at it. A fresh one is made the first time if none exists.
#   KEYSTORE=/path/to/garden.keystore KEYSTORE_PASS=yourpassword ./build.sh
set -euo pipefail
cd "$(dirname "$0")"
export JAVA_TOOL_OPTIONS=""
SDK=${ANDROID_SDK:-/usr/lib/android-sdk}
AJAR=$SDK/platforms/android-23/android.jar
KEYSTORE=${KEYSTORE:-garden.keystore}
KEYSTORE_PASS=${KEYSTORE_PASS:-gardenkey}

rm -rf build && mkdir -p build/gen build/classes build/dex assets
cp ../web/index.html assets/index.html
cp -R ../web/audio assets/
[ -f res/mipmap-xxxhdpi/ic_launcher.png ] || python3 tools/make_icons.py

echo "== resources + manifest (and R.java)"
aapt package -f -m -M AndroidManifest.xml -S res -A assets -I "$AJAR" -J build/gen -F build/app.res.apk

echo "== compile"
javac -source 8 -target 8 -Xlint:-options -bootclasspath "$AJAR" -classpath "$AJAR" -d build/classes \
  build/gen/org/rdgarden/app/R.java src/org/rdgarden/app/MainActivity.java

echo "== dex"
dalvik-exchange --dex --min-sdk-version=23 --output=build/dex/classes.dex build/classes

echo "== assemble"
cp build/app.res.apk build/app.unsigned.apk
( cd build/dex && zip -q -X ../app.unsigned.apk classes.dex )

echo "== align"
zipalign -f -p 4 build/app.unsigned.apk build/app.aligned.apk

echo "== sign"
if [ ! -f "$KEYSTORE" ]; then
  echo "no keystore at $KEYSTORE; making one (keep it: later builds must be signed with the same key to update in place)"
  keytool -genkeypair -v -keystore "$KEYSTORE" -storepass "$KEYSTORE_PASS" -keypass "$KEYSTORE_PASS" -alias garden \
    -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Reaction-diffusion garden, OU=Garden, O=Garden, C=US" >/dev/null 2>&1
fi
apksigner sign --ks "$KEYSTORE" --ks-pass "pass:$KEYSTORE_PASS" --key-pass "pass:$KEYSTORE_PASS" --ks-key-alias garden \
  --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true \
  --out build/garden.apk build/app.aligned.apk

echo "== verify"
apksigner verify --print-certs build/garden.apk | head -3
aapt dump badging build/garden.apk | grep -E "^package|^sdkVersion|^targetSdkVersion|^application-label"
ls -la build/garden.apk
