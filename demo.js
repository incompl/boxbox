document.addEventListener("DOMContentLoaded", function() {
    
    var canvas = document.getElementById('bbdemo');
    
    var world = BB.createWorld(canvas);
    
    var player = world.createEntity({
        name: 'player',
        x: .5,
        y: 12,
        height: .2,
        width: .1,
        fixedRotation: true,
        friction: .5
    });
    
    player.onKeydown(function(e) {

        var i;
        var obj;
        var player = this;

        // determine what you're standing on
        var standingOn;
        var pos = this.position();
        var allUnderMe = world.findAll(pos.x, pos.y + .2, pos.x + .1, pos.y + .3);
        for (i = 0; i < allUnderMe.length; i++) {
            obj = allUnderMe[i];
            if (obj !== player) {
                standingOn = obj;
                break;
            }
        }
        
        // jump
        if (e.keyCode === 32 && standingOn) {
            console.log('jumping off ' + standingOn.name);
            this.applyImpulse(1);
            return false;
        }

        // when airborn movement is restricted
        var force = 2;
        if (!standingOn) {
            force = force / 2;
        }

        // move left
        if (e.keyCode === 37) {
            this.setForce('movement', force, 270);
            return false;
        }

        // move right
        if (e.keyCode === 39) {
            this.setForce('movement', force, 90);
            return false;
        }
    });
    
    player.onKeyup(function(e) {
        // clear movement force on keyup
        if (e.keyCode === 37) {
            this.clearForce('movement');
            return false;
        }
        else if (e.keyCode === 39) {
            this.clearForce('movement');
            return false;
        }
    });
    
    player.onStartContact(function(other) {
        console.log(this.name + ' touched ' + other.name);
    });

    player.onFinishContact(function(other) {
        console.log(this.name + ' pulled away from ' + other.name);
    });

    player.onImpact(function(other, power, tangentPower) {
        if (power > 1) {
            console.log('strong collision with ' + other.name + ' ' + power);
        }
        if (tangentPower > 1 || tangentPower < -1) {
            console.log('strong friction against ' + other.name + ' ' + tangentPower);
        }
    });

    world.createEntity({
        name: 'ground',
        type: 'static',
        width: 10,
        height: .1,
        x: 10,
        y: 13.22
    });

    world.createEntity({
        name: 'ground',
        type: 'static',
        width: 4,
        height: .1,
        x: 4,
        y: 5
    });

    world.createEntity({
        name: 'ground',
        type: 'static',
        width: 4,
        height: .1,
        x: 16,
        y: 5
    });
    
    world.createEntity({
        name: 'square',
        x: 13,
        y: 8
    });
    
    world.createEntity({
        name: 'circle',
        shape: 'circle',
        x: 14,
        y: 3
    });
    
    world.createEntity({
        name: 'poly',
        shape: 'polygon',
        x: 5,
        y: 8
    });

    var platform = world.createEntity({
        name: 'platform',
        fixedRotation: true,
        height: .1
    });

    var platformMovingUp = true;
    window.setInterval(function() {
        platformMovingUp = !platformMovingUp;
        if (platformMovingUp) {
            platform.setVelocity('moving platform', 5, 0);
        }
        else {
            platform.setVelocity('moving platform', 5, 180);
        }
    }, 1500);
    
}, false);
