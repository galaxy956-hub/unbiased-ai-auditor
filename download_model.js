const { pipeline, env } = require('@xenova/transformers');

// Prevent downloading large model weights to the temporary local cache during build.
// We want them downloaded to the current working directory or a persistent spot in the container.
env.allowLocalModels = false;
env.useBrowserCache = false;
env.cacheDir = './.cache';

async function download() {
    console.log("Downloading local AI model for offline inference...");
    try {
        // This command doesn't generate text, it just initializes the pipeline,
        // forcing the model files to be downloaded and cached.
        await pipeline('text-generation', 'Xenova/Qwen1.5-0.5B-Chat');
        console.log("✅ Model downloaded successfully.");
    } catch (error) {
        console.error("❌ Failed to download model:", error);
        process.exit(1);
    }
}

download();
