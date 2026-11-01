# The page calls the bridge by name: its methods must survive R8.
-keepclassmembers class com.chessreader.app.BooksBridge {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface
