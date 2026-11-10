package com.example

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.lifecycle.lifecycleScope
import com.example.data.db.FiberDatabase
import com.example.data.repository.FiberRepository
import com.example.data.repository.SettingsRepository
import com.example.ui.FiberMapApp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

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

        // Ensure database has initial seed data ready for review
        lifecycleScope.launch(Dispatchers.IO) {
            val existingLines = database.lineDao().getAllLines()
            if (existingLines.isEmpty()) {
                database.seedInitialData()
            }
        }

        setContent {
            FiberMapApp(
                fiberRepository = fiberRepository,
                settingsRepository = settingsRepository
            )
        }
    }
}
