window.BB = (function() {
    
    // Make sure Box2D exists
    if (Box2D === undefined) {
        console.error('boxbox needs Box2d to work');
        return;
    }
    
    // Object creation inspired by Crockford
    // http://javascript.crockford.com/prototypal.html
    function create(o) {
        function F() {}
        F.prototype = o;
        return new F();
    }
    
    // A minimal extend for simple objects inspired by jQuery
    function extend(target, o) {
        if (target === undefined) {
            target = {};
        }
        if (o !== undefined) {
            for (var key in o) {
                if (o.hasOwnProperty(key) && target[key] === undefined) {
                    target[key] = o[key];
                }
            }
        }
        return target;
    }

    // Standard imports. TODO mechanism for custom imports
    var b2Vec2 = Box2D.Common.Math.b2Vec2;
    var b2BodyDef = Box2D.Dynamics.b2BodyDef;
    var b2Body = Box2D.Dynamics.b2Body;
    var b2FixtureDef = Box2D.Dynamics.b2FixtureDef;
    var b2Fixture = Box2D.Dynamics.b2Fixture;
    var b2World = Box2D.Dynamics.b2World;
    var b2MassData = Box2D.Collision.Shapes.b2MassData;
    var b2PolygonShape = Box2D.Collision.Shapes.b2PolygonShape;
    var b2CircleShape = Box2D.Collision.Shapes.b2CircleShape;
    var b2DebugDraw = Box2D.Dynamics.b2DebugDraw;
    
    // BB methods
        
    this.createWorld = function(canvasElem, ops) {
        var world = create(World);
        world._init(canvasElem, ops);
        return world;
    }
    
    var WORLD_DEFAULT_OPTIONS = {
        gravity: 10,
        allowSleep: true
    }

    var World = {
        
        _init: function(canvasElem, options) {
            this._ops = extend(options, WORLD_DEFAULT_OPTIONS);
            this._world = new b2World(new b2Vec2(0, this._ops.gravity), true);
            this._canvas = canvasElem;
            
            // Set up rendering on the provided canvas
            if (this._canvas !== undefined) {
                var world = this._world;
                
                var debugDraw = new b2DebugDraw();
                debugDraw.SetSprite(this._canvas.getContext("2d"));
                debugDraw.SetDrawScale(30.0);
                debugDraw.SetFillAlpha(0.3);
                debugDraw.SetLineThickness(1.0);
                debugDraw.SetFlags(b2DebugDraw.e_shapeBit | b2DebugDraw.e_jointBit);
                world.SetDebugDraw(debugDraw);
                
                (function animationLoop(){
                    // framerate, velocity iterations, position iterations
                    world.Step(1 / 60, 10, 10);
                    world.DrawDebugData();
                    // TODO paul irish shim
                    window.webkitRequestAnimationFrame(animationLoop);
                })();
            }
        },
        
        gravity: function(value) {
            if (value !== undefined) {
                this._ops.gravity = value;
                this._world.SetGravity(new b2Vec2(0, this._ops.gravity))
            }
            return this._ops.gravity;
        },
        
        createEntity: function(o) {
            var entity = create(Entity);
            entity._init(this._world, o);
            return entity;
        }
        
    };
    
    var ENTITY_DEFAULT_OPTIONS = {
        x: 10,
        y: 5,
        type: 'dynamic', // or static
        shape: 'box', // or circle
        height: 1, // for box
        width: 1, // for box
        radius: 1, // for circle
        density: 1,
        friction: .5,
        restitution: .2
    };
    
    var Entity = {
        
        _init: function(world, options) {
            this._ops = extend(options, ENTITY_DEFAULT_OPTIONS);
            var ops = this._ops;
            
            var fixture = new b2FixtureDef;
            fixture.density = ops.density;
            fixture.friction = ops.friction;
            fixture.restitution = ops.restitution;

            var body = new b2BodyDef;
            body.position.x = ops.x;
            body.position.y = ops.y;
            
            if (ops.type === 'static') {
                body.type = b2Body.b2_staticBody;
            }
            else if (ops.type === 'dynamic') {
                body.type = b2Body.b2_dynamicBody;
            }
            
            if (ops.shape === 'box') {
                fixture.shape = new b2PolygonShape;
                fixture.shape.SetAsBox(ops.width, ops.height);
            }
            else if (ops.shape === 'circle') {
                fixture.shape = new b2CircleShape(ops.radius);
            }
            
            world.CreateBody(body).CreateFixture(fixture);
        }
        
    }
    
    return this;

})();