(function() {
      
    var canvas = document.getElementById('bbdemo');
    
    var world = boxbox.createWorld(canvas, {debugDraw:false});
    
    player = world.createEntity({
        name: 'player',
        x: .5,
        y: 12,
        height: .4,
        width: .4,
        fixedRotation: true,
        friction: .3,
        restitution: 0,
        color: 'blue',
        maxVelocityX: 4
    });

    var health = 100;
    
    var score = 0;
    
    function damage(x) {
        if (player._destroyed) {
            return;
        }
        health -= Math.round(x);
        if (health < 1) {
            health = 0;
            player.destroy();
            alert('Game over.');
        }
        document.getElementById('health').innerHTML = health;
    }
    
    function addScore(x) {
        score += Math.round(x);
        document.getElementById('score').innerHTML = '' + score;
    }
    
    player.onKeydown(function(e) {
        
        if (this._destroyed) {
            return;
        }

        var i;
        var obj;
        var player = this;

        // determine what you're standing on
        var standingOn;
        var pos = this.position();
        var allUnderMe = world.find(pos.x - .08, pos.y + .1, pos.x + .09, pos.y + .105);
        for (i = 0; i < allUnderMe.length; i++) {
            obj = allUnderMe[i];
            if (obj !== player) {
                standingOn = obj;
                break;
            }
        }
        
        // jump
        if (e.keyCode === 32 && standingOn) {
            this.applyImpulse(2);
            return false;
        }

        // when airborn movement is restricted
        var force = 8;
        if (!standingOn) {
            force = force / 2;
        }

        // move left
        if (e.keyCode === 37) {
            this.setForce('movement', force, 270);
            this.friction(.1);
            return false;
        }

        // move right
        if (e.keyCode === 39) {
            this.setForce('movement', force, 90);
            this.friction(.1);
            return false;
        }
        
    });
    
    player.onKeyup(function(e) {
        
        if (this._destroyed) {
            return;
        }
        
        // clear movement force on arrow keyup
        if (e.keyCode === 37 || e.keyCode === 39) {
            this.clearForce('movement');
            this.friction(3);
            return false;
        }
        
    });

    player.onImpact(function(other, power, tangentPower) {
        if (power > 3) {
            damage(power - 3);
        }
    });
    
    world.onRender(function(ctx) {
        
        // update camera position every draw
        var p = player.position();
        var c = this.camera();
        
        if (p.y < 14) {
            if (p.x - 8 < c.x) { 
                this.camera({x: player.position().x - 8});
            }
            else if (p.x - 12 > c.x) { 
                this.camera({x: player.position().x - 12});
            }
        }
        
        // If you fall off the world, zoom out
        else {
            var scale = 30;
            scale -= (p.y - 14);
            scale = scale < 1 ? 1 : scale;
            this.scale(scale);
            
            var newCameraX = c.x;
                if (newCameraX > -9 || newCameraX < -11) {
                if (newCameraX > -10) {
                    newCameraX = newCameraX - .3;
                }
                if (newCameraX < -10) {
                    newCameraX = newCameraX + .3;
                }
                this.camera({x: newCameraX});
            }
        }
        
        // Rendering for the joint between the two wheels
        var p1 = wheel1.canvasPosition();
        var p2 = wheel2.canvasPosition();
        ctx.strokeStyle = "black";
        ctx.lineWidth = 3;
        ctx.beginPath();  
        ctx.moveTo(p1.x, p1.y);  
        ctx.lineTo(p2.x, p2.y);    
        ctx.stroke();  
    });

    var groundTemplate = {
        name: 'ground',
        type: 'static',
        height: .2,
        color: 'green',
        borderColor: 'rgba(0, 100, 0, .5)',
        borderWidth: 3
    };

    world.createEntity(groundTemplate, {width: 20, x: 10, y: 13.22});

    world.createEntity(groundTemplate, {width: 6, x: 3, y: 5});

    world.createEntity(groundTemplate, {width: 8, x: 16, y: 5});
    
    world.createEntity({
        name: 'square',
        x: 13,
        y: 8,
        height: 1.6,
        width: .4,
        imageOffsetY: -.2
    });
    
    world.createEntity({
        name: 'circle',
        shape: 'circle',
        radius: 2,
        x: 14,
        y: 3,
        density: .5,
        image: 'wheel.png',
        imageStretchToFit: true
    });
    
    world.createEntity({
        name: 'poly',
        shape: 'polygon',
        x: 5,
        y: 8
    });

    // Car thing
    var wheelTemplate = {
        name: 'wheel',
        shape: 'circle',
        radius: 1,
        image: 'wheel.png',
        imageStretchToFit: true
    };
    var wheel1 = world.createEntity(wheelTemplate, {x: 1, y:1});
    var wheel2 = world.createEntity(wheelTemplate, {x: 4, y:1});
    world.createJoint(wheel1, wheel2);

    var platform = world.createEntity({
        name: 'platform',
        fixedRotation: true,
        height: .2,
        width: 2
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
    
    var coinTemplate = {
        name: 'coin',
        shape: 'circle',
        radius: .1,
        color: 'yellow',
        onStartContact: function(other) {
            if (other.name() === 'player') {
                addScore(100);
                this.destroy();
            }
        }
    };
    
    world.createEntity(coinTemplate, {x: 2, y: 4});
    
    world.createEntity(coinTemplate, {x: 2, y: 12});
    
    world.createEntity(coinTemplate, {
        x: 16,
        y: 5,
        shape: 'square',
        height: .2,
        width: .2
    });
    
})();