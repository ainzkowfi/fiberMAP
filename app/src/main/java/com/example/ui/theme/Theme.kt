package com.example.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

@Immutable
data class ExtendedFiberColors(
    val jacket: Color,
    val cut: Color,
    val repaired: Color,
    val muted: Color,
    val border: Color,
    val paper: Color
)

val LocalFiberColors = staticCompositionLocalOf {
    ExtendedFiberColors(
        jacket = JacketLight,
        cut = CutLight,
        repaired = RepairedLight,
        muted = MutedLight,
        border = BorderLight,
        paper = PaperLight
    )
}

private val LightColorScheme = lightColorScheme(
    primary = JacketLight,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFD6EFF2),
    onPrimaryContainer = Color(0xFF033840),
    secondary = MutedLight,
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFDFE6EB),
    onSecondaryContainer = InkLight,
    tertiary = CutLight,
    onTertiary = Color.White,
    background = PaperLight,
    onBackground = InkLight,
    surface = SurfaceLight,
    onSurface = InkLight,
    surfaceVariant = SurfaceVariantLight,
    onSurfaceVariant = InkLight,
    outline = BorderLight,
    error = CutLight,
    onError = Color.White
)

private val DarkColorScheme = darkColorScheme(
    primary = JacketDark,
    onPrimary = PaperDark,
    primaryContainer = Color(0xFF0C4D58),
    onPrimaryContainer = Color(0xFFD6F6FA),
    secondary = MutedDark,
    onSecondary = PaperDark,
    secondaryContainer = Color(0xFF263942),
    onSecondaryContainer = InkDark,
    tertiary = CutDark,
    onTertiary = PaperDark,
    background = PaperDark,
    onBackground = InkDark,
    surface = SurfaceDark,
    onSurface = InkDark,
    surfaceVariant = SurfaceVariantDark,
    onSurfaceVariant = InkDark,
    outline = BorderDark,
    error = CutDark,
    onError = PaperDark
)

@Composable
fun FiberMapTheme(
    themeMode: String = "system", // "system", "light", "dark"
    content: @Composable () -> Unit
) {
    val isDark = when (themeMode.lowercase()) {
        "dark" -> true
        "light" -> false
        else -> isSystemInDarkTheme()
    }

    val colorScheme = if (isDark) DarkColorScheme else LightColorScheme
    val extendedColors = if (isDark) {
        ExtendedFiberColors(
            jacket = JacketDark,
            cut = CutDark,
            repaired = RepairedDark,
            muted = MutedDark,
            border = BorderDark,
            paper = PaperDark
        )
    } else {
        ExtendedFiberColors(
            jacket = JacketLight,
            cut = CutLight,
            repaired = RepairedLight,
            muted = MutedLight,
            border = BorderLight,
            paper = PaperLight
        )
    }

    CompositionLocalProvider(LocalFiberColors provides extendedColors) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = Typography,
            content = content
        )
    }
}
