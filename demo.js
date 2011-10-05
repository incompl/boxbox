document.addEventListener("DOMContentLoaded", function() {
    
    var canvas = document.getElementById('bbdemo');;
    
    var world = BB.createWorld(canvas);
    
    world.createEntity({
        type: 'static',
        width: 10,
        height: .1,
        x: 10,
        y: 13.22
    });
    
    world.createEntity();
    
    world.createEntity({
        shape: 'circle',
        x: 10.5,
        y: 8
    })
    
}, false);