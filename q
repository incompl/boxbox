diff --git a/boxbox.js b/boxbox.js
index 89701bf..90329a7 100644
--- a/boxbox.js
+++ b/boxbox.js
@@ -1,3 +1,12 @@
+/**
+ * @header boxbox
+ * @description javascript physics made easy
+ */
+
+/**
+ * @header global boxbox object
+ * @module boxbox
+ */
 window.boxbox = (function() {
     
     // Make sure Box2D exists
@@ -44,7 +53,10 @@ window.boxbox = (function() {
     var b2AABB = Box2D.Collision.b2AABB;
     
     // BB methods
-        
+    
+    /**
+     * @module boxbox
+     */
     this.createWorld = function(canvasElem, ops) {
         var world = create(World);
         world._init(canvasElem, ops);
@@ -700,4 +712,4 @@ window.boxbox = (function() {
     
     return this;
 
-})();
\ No newline at end of file
+})();
diff --git a/demo.html b/demo.html
index b643f72..a952bf0 100644
--- a/demo.html
+++ b/demo.html
@@ -15,10 +15,12 @@
                 background-color: #d9d9d9;
             }
             canvas {
+                float: left;
                 background-color: white;
             }
             #hud {
-                padding: .5em 1em;
+                float: left;
+                padding: 1em;
             }
         </style>
     </head>
@@ -27,11 +29,13 @@
             your browser doesn't support canvas
         </canvas>
         <div id="hud">
-            arrow keys to move, space to jump
+            arrow keys to move
+            <br>
+            space to jump
             <br>
             health: <span id="health">100</span>
             <br>
             score: <span id="score">0</span>
         </div>
     </body>
-</html>
+</html>
\ No newline at end of file
diff --git a/demo.js b/demo.js
index e06497d..a2be044 100644
--- a/demo.js
+++ b/demo.js
@@ -51,7 +51,7 @@ document.addEventListener("DOMContentLoaded", function() {
         // determine what you're standing on
         var standingOn;
         var pos = this.position();
-        var allUnderMe = world.findAll(pos.x - .09, pos.y + .1, pos.x + .09, pos.y + .105);
+        var allUnderMe = world.findAll(pos.x - .08, pos.y + .1, pos.x + .09, pos.y + .105);
         for (i = 0; i < allUnderMe.length; i++) {
             obj = allUnderMe[i];
             if (obj !== player) {
@@ -114,11 +114,33 @@ document.addEventListener("DOMContentLoaded", function() {
         // update camera position every draw
         var p = player.position();
         var c = this.camera();
-        if (p.x - 8 < c.x) { 
-            this.camera(player.position().x - 8);
+        
+        if (p.y < 14) {
+            if (p.x - 8 < c.x) { 
+                this.camera(player.position().x - 8);
+            }
+            else if (p.x - 12 > c.x) { 
+                this.camera(player.position().x - 12);
+            }
         }
-        else if (p.x - 12 > c.x) { 
-            this.camera(player.position().x - 12);
+        
+        // If you fall off the world, zoom out
+        else {
+            var scale = 30;
+            scale -= (p.y - 14);
+            scale = scale < 1 ? 1 : scale;
+            this.scale(scale);
+            
+            var newCameraX = c.x;
+                if (newCameraX > -9 || newCameraX < -11) {
+                if (newCameraX > -10) {
+                    newCameraX = newCameraX - .3;
+                }
+                if (newCameraX < -10) {
+                    newCameraX = newCameraX + .3;
+                }
+                this.camera(newCameraX);
+            }
         }
         
         // Rendering for the joint between the two wheels
