#!/usr/bin/env bash
set -e
mkdir -p .render-runtime/jdk
curl -fL "https://api.adoptium.net/v3/binary/latest/17/ga/linux/x64/jdk/hotspot/normal/eclipse" -o /tmp/temurin-jdk.tar.gz
tar -xzf /tmp/temurin-jdk.tar.gz --strip-components=1 -C .render-runtime/jdk
export JAVA_HOME="$PWD/.render-runtime/jdk"
export PATH="$JAVA_HOME/bin:$PATH"
chmod +x ./mvnw
./mvnw -B -DskipTests clean package
