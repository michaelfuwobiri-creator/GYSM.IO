plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "io.gysm.stream"
    compileSdk = 34

    defaultConfig {
        applicationId = "io.gysm.stream"
        minSdk = 22 // Fire OS 5 (Fire TV Stick 2nd gen) and newer
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
    }

    // The web app in ../../web is packaged as the APK's assets and served
    // from https://appassets.androidplatform.net/assets/ (see MainActivity).
    sourceSets["main"].assets.srcDirs("../../web")

    buildTypes {
        release {
            isMinifyEnabled = false
            // Sign with your own key for the Amazon Appstore, see README.
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
