FROM maven:3.9.11-eclipse-temurin-21 AS build
WORKDIR /work
COPY pom.xml .
COPY src ./src
RUN mvn -B -ntp verify

FROM eclipse-temurin:21-jre
WORKDIR /srv
RUN useradd --system --create-home --uid 10001 solin
COPY --from=build /work/target/mdb-export-service-0.1.0.jar ./service.jar
USER solin
ENV PORT=8080 SOLIN_TEMPLATE_DIR=/data/templates
EXPOSE 8080
ENTRYPOINT ["java","-XX:MaxRAMPercentage=70.0","-jar","/srv/service.jar"]
