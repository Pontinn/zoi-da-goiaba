{
  "targets": [
    {
      "target_name": "zoi_audio_capture",
      "sources": [
        "src/addon.cc",
        "src/capture_engine.cc",
        "src/mixer.cc",
        "src/session_tracker.cc"
      ],
      "include_dirs": ["<!(node -p \"require('node-addon-api').include_dir\")"],
      "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS", "UNICODE", "_UNICODE", "NOMINMAX"],
      "conditions": [
        [
          "OS==\"win\"",
          {
            "libraries": ["-lmmdevapi.lib", "-lole32.lib"],
            "msvs_settings": {
              "VCCLCompilerTool": {
                "AdditionalOptions": ["/std:c++17"],
                "ExceptionHandling": 1
              }
            }
          }
        ]
      ]
    }
  ]
}
