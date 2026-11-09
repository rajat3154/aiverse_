#!/usr/bin/env bash
set -e
export SPRING_PROFILES_ACTIVE="${SPRING_PROFILES_ACTIVE:-production}"
export JAVA_HOME="$PWD/.render-runtime/jdk"
export PATH="$JAVA_HOME/bin:$PATH"
JAR_FILE=$(find target -maxdepth 1 -type f -name "*.jar" ! -name "*.original" | head -n 1)
if [ -z "$JAR_FILE" ]; then
  echo "Flowable JAR not found"
  exit 1
fi
exec "$JAVA_HOME/bin/java" -jar "$JAR_FILE"
