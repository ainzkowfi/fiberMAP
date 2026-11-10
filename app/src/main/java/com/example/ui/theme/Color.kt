package com.example.ui.theme

import androidx.compose.ui.graphics.Color

// fiberMAP Core Field Palette (Design Tokens)
// High-contrast, sunlight-visible, engineered for outdoor technicians
val PaperLight = Color(0xFFF4F6F7)      // Crisp light neutral for outdoors
val SurfaceLight = Color(0xFFFFFFFF)
val SurfaceVariantLight = Color(0xFFE2E7EA)
val InkLight = Color(0xFF16242B)        // Deep slate-ink for maximum contrast in glare
val JacketLight = Color(0xFF0A7C8C)     // Primary Action - Fiber Jacket Teal
val JacketHoverLight = Color(0xFF076573)
val CutLight = Color(0xFFC8372D)        // Emergency Cut / Break Red
val RepairedLight = Color(0xFF2F8F5B)   // Fusion Splice Repaired Green
val MutedLight = Color(0xFF6F7F89)      // Secondary text and grid
val BorderLight = Color(0xFFCBD5DC)

// Dark Mode Tokens (Night and Low-Light Field Operations)
val PaperDark = Color(0xFF0F171B)       // Deep slate night background
val SurfaceDark = Color(0xFF162228)     // Slightly elevated dark surface
val SurfaceVariantDark = Color(0xFF1F2E36)
val InkDark = Color(0xFFEDF2F4)         // High-contrast crisp light text
val JacketDark = Color(0xFF14A3B8)      // Bright vivid cyan for dark mode
val JacketHoverDark = Color(0xFF38B8CC)
val CutDark = Color(0xFFE64A38)         // High-visibility vivid red
val RepairedDark = Color(0xFF38B26C)    // High-visibility bright green
val MutedDark = Color(0xFF94A3AD)       // Secondary muted text
val BorderDark = Color(0xFF2C3E47)

// Standard 12-Strand Fiber Color Code
val FiberBlue = Color(0xFF0066CC)
val FiberOrange = Color(0xFFFF7A00)
val FiberGreen = Color(0xFF00A854)
val FiberBrown = Color(0xFF8B5A2B)
val FiberSlate = Color(0xFF708090)
val FiberWhite = Color(0xFFE2E8F0)
val FiberRed = Color(0xFFD9383A)
val FiberBlack = Color(0xFF2D3748)
val FiberYellow = Color(0xFFF5A623)
val FiberViolet = Color(0xFF8E44AD)
val FiberRose = Color(0xFFE84393)
val FiberAqua = Color(0xFF00B4D8)

fun getFiberColor(colorKey: String): Color {
    return when (colorKey.lowercase()) {
        "blue" -> FiberBlue
        "orange" -> FiberOrange
        "green" -> FiberGreen
        "brown" -> FiberBrown
        "slate" -> FiberSlate
        "white" -> FiberWhite
        "red" -> FiberRed
        "black" -> FiberBlack
        "yellow" -> FiberYellow
        "violet" -> FiberViolet
        "rose" -> FiberRose
        "aqua" -> FiberAqua
        else -> FiberBlue
    }
}
