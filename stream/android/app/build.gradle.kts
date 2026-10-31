import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Release signing key, kept out of git. Copy keystore.properties.example to
// keystore.properties and fill it in (see store-assets/SUBMISSION.md).
val keystoreProps = Properties().apply {
    val f = rootProject.file("keystore.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}

android {
    namespace = "io.gysm.stream"
    compileSdk = 34

    defaultConfig {
        applicationId = "io.gysm.stream"
        minSdk = 22 // Fire OS 5 (Fire TV Stick 2nd gen) and newer
        targetSdk = 34
        versionCode = 2
        versionName = "1.0.1"
    }

    // The web app in ../../web is packaged as the APK's assets and served
    // from https://appassets.androidplatform.net/assets/ (see MainActivity).
    sourceSets["main"].assets.srcDirs("../../web")

    signingConfigs {
        if (keystoreProps.containsKey("storeFile")) {
            create("release") {
                storeFile = rootProject.file(keystoreProps.getProperty("storeFile"))
                storePassword = keystoreProps.getProperty("storePassword")
                keyAlias = keystoreProps.getProperty("keyAlias")
                keyPassword = keystoreProps.getProperty("keyPassword")
                enableV1Signing = true
                enableV2Signing = true // required by Fire OS 8
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.findByName("release")
        }
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.webkit:webkit:1.11.0")
}
