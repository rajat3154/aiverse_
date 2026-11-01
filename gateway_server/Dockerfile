# Build context is the repository root (see render.yaml) so the shared logging library is available.
FROM eclipse-temurin:17-jdk AS build
WORKDIR /build

COPY logging/java logging/java
COPY gateway_server/.mvn gateway_server/.mvn
COPY gateway_server/mvnw gateway_server/pom.xml gateway_server/

WORKDIR /build/gateway_server
RUN chmod +x mvnw && ./mvnw -B -q -DskipTests -f ../logging/java/pom.xml install
RUN ./mvnw -B -q dependency:go-offline
COPY gateway_server/src src
RUN ./mvnw -B -DskipTests clean package

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /build/gateway_server/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
