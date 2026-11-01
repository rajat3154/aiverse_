#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
RUNTIME_DIR="$PWD/.render-runtime"
mkdir -p "$RUNTIME_DIR/jdk"

echo "Downloading Java 17 JDK..."
curl -fL --retry 3 "https://api.adoptium.net/v3/binary/latest/17/ga/linux/x64/jdk/hotspot/normal/eclipse" -o /tmp/temurin-jdk.tar.gz

echo "Extracting Java runtime..."
tar -xzf /tmp/temurin-jdk.tar.gz -C "$RUNTIME_DIR/jdk" --strip-components=1

export JAVA_HOME="$RUNTIME_DIR/jdk"
export PATH="$JAVA_HOME/bin:$PATH"
java -version

echo "Building AIVERSE Gateway..."
chmod +x ./mvnw
./mvnw -B -q -DskipTests -f ../logging/java/pom.xml install
./mvnw -B -DskipTests clean package
echo "Gateway build completed."
