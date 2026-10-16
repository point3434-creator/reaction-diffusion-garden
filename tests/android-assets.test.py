"""Exercise build.sh's real asset staging, stopping at the unavailable SDK boundary."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


class AndroidAssets(unittest.TestCase):
    def test_build_stages_soundtrack_bytes(self):
        root = Path(__file__).resolve().parent.parent
        with tempfile.TemporaryDirectory(prefix="garden-android-assets-") as temp:
            work = Path(temp)
            android = work / "android"
            android.mkdir()
            shutil.copyfile(root / "android/build.sh", android / "build.sh")
            icons = android / "res/mipmap-xxxhdpi"
            icons.mkdir(parents=True)
            (icons / "ic_launcher.png").write_bytes(b"fixture icon")
            audio = work / "web/audio"
            audio.mkdir(parents=True)
            (work / "web/index.html").write_text("<html>fixture page</html>", encoding="utf-8")
            (audio / "Liquid_Bloom.mp3").write_bytes(b"fixture recording bytes")
            tools = work / "test-bin"
            tools.mkdir()
            boundary = tools / "aapt"
            boundary.write_text("#!/usr/bin/env bash\nexit 77\n", encoding="utf-8")
            boundary.chmod(0o755)
            bash = os.environ.get("ANDROID_TEST_BASH", "bash")
            result = subprocess.run(
                [bash, "-c", 'PATH="$PWD/test-bin:$PATH" bash android/build.sh'],
                cwd=work, capture_output=True, text=True,
            )
            self.assertEqual(result.returncode, 77, result.stdout + result.stderr)
            self.assertEqual((android / "assets/index.html").read_bytes(), (work / "web/index.html").read_bytes())
            staged = android / "assets/audio/Liquid_Bloom.mp3"
            self.assertTrue(staged.is_file(), "Android build omitted the soundtrack recording")
            self.assertEqual(staged.read_bytes(), b"fixture recording bytes")


if __name__ == "__main__":
    unittest.main()
