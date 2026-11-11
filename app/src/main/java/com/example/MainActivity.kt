package com.example

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.*
import androidx.lifecycle.lifecycleScope
import com.example.data.db.FiberDatabase
import com.example.data.repository.FiberRepository
import com.example.data.repository.SettingsRepository
import com.example.ui.FiberMapApp
import com.example.ui.components.ErrorScreen
import com.example.ui.theme.FiberMapTheme
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.io.PrintWriter
import java.io.StringWriter

class MainActivity : ComponentActivity() {

    private lateinit var database: FiberDatabase
    private lateinit var fiberRepository: FiberRepository
    private lateinit var settingsRepository: SettingsRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        database = FiberDatabase.getInstance(this)
        fiberRepository = FiberRepository(database)
        settingsRepository = SettingsRepository(database)

        var fatalError by mutableStateOf<String?>(null)

        // Global crash handler to present ErrorScreen with copyable logs instead of forced closing
        val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            val sw = StringWriter()
            val pw = PrintWriter(sw)
            throwable.printStackTrace(pw)
            val stackTrace = sw.toString()

            Handler(Looper.getMainLooper()).post {
                fatalError = stackTrace
            }
        }

        setContent {
            FiberMapTheme {
                val currentError = fatalError
                if (currentError != null) {
                    ErrorScreen(
                        errorLogs = currentError,
                        onRestart = {
                            fatalError = null
                            recreate()
                        },
                        onResetDatabase = {
                            lifecycleScope.launch(Dispatchers.IO) {
                                database.clearAllTables()
                                launch(Dispatchers.Main) {
                                    fatalError = null
                                    recreate()
                                }
                            }
                        }
                    )
                } else {
                    FiberMapApp(
                        fiberRepository = fiberRepository,
                        settingsRepository = settingsRepository
                    )
                }
            }
        }
    }
}
