(function() {
    
    var canvas = document.getElementById('bbdemo');
    
    var world = boxbox.createWorld(canvas, {gravity: {x: 0, y: 20}});
    
    var thisEntity;
    var previousEntity;
    
    var linkTemplate = {
        width: .4,
        height: 1,
        image: "parakeet chain.jpg",
        imageStretchToFit: true
    };
    
    var x = 4.2;
    
    thisEntity = world.createEntity(linkTemplate, {x: x, y: -1, type: "static"});
    
    var y;
    for (y = 0; y < 8; y++) {
    
        previousEntity = thisEntity;
        thisEntity = world.createEntity(linkTemplate, {x: x, y: y});
        
        world.createJoint(previousEntity, thisEntity, {
            type: "revolute",
            jointPositionOnEntity1: {x:0, y:.25},
            jointPositionOnEntity2: {x:0, y:.25}
        });
    
    }
    
    previousEntity = thisEntity;
    thisEntity = world.createEntity({
        x: x,
        y: y,
        image: "parakeet toy.gif",
        imageOffsetX: -1.5,
        imageOffsetY: -.3,
        density: 5,
        width: 2,
        height: 2
    });
        
    world.createJoint(previousEntity, thisEntity, {
        type: "revolute"
    });
    
    window.peck = function() {
        thisEntity.applyImpulse(150, Number(Math.random() * 360));
    }
     
})();

