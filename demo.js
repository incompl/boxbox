document.addEventListener("DOMContentLoaded", function() {
    
    var canvas = document.getElementById('bbdemo');;
    
    var world = BB.createWorld(canvas);
    
    var myBox = world.createEntity({
        fixedRotation: true,
        width: .5
    });
    
    var MOVEMENT_FORCE = 35;
    
    myBox.onKeydown(function(e) {
        if (e.keyCode === 32) {
            this.applyImpulse(10);
            return false;
        }
        else if (e.keyCode === 37) {
            this.setForce(MOVEMENT_FORCE, 270);
            return false;
        }
        else if (e.keyCode === 39) {
            this.setForce(MOVEMENT_FORCE, 90);
            return false;
        }
    });
    
    myBox.onKeyup(function(e) {
        if (e.keyCode === 37) {
            this.setForce(0, 0);
            return false;
        }
        else if (e.keyCode === 39) {
            this.setForce(0, 0);
            return false;
        }
    });
    
    world.createEntity({
        type: 'static',
        width: 10,
        height: .1,
        friction: 1,
        x: 10,
        y: 13.22
    });
    
    world.createEntity({
        x: 13,
        y: 8
    });
    
    world.createEntity({
        shape: 'circle',
        x: 10.5,
        y: 8
    });
    
    world.createEntity({
        shape: 'polygon',
        x: 7,
        y: 8
    });
    
}, false);
