/*
Copyright (C) 2012 Greg Smith <gsmith@incompl.com>

Released under the MIT license:
https://github.com/incompl/boxbox/blob/master/LICENSE

Created at Bocoup http://bocoup.com
*/

/**
 * @_page_title boxbox
 * @_page_css updoc-custom.css
 * @_page_description api documentation
 * @_page_home_path .
 * @_page_compact_index
 */

// Paul Irish requestAnimationFrame shim
// http://paulirish.com/2011/requestanimationframe-for-smart-animating/
window.requestAnimFrame = (function(){
    return window.requestAnimationFrame || 
           window.webkitRequestAnimationFrame || 
           window.mozRequestAnimationFrame || 
           window.oRequestAnimationFrame || 
           window.msRequestAnimationFrame || 
           function (callback){
               window.setTimeout(callback, 1000 / 60);
           };
}());

/**
 * @description global boxbox object
 */
window.boxbox = (function() {
    
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

    // these look like imports but there is no cost here
    var b2Vec2 = Box2D.Common.Math.b2Vec2;
    var b2Math = Box2D.Common.Math.b2Math;
    var b2BodyDef = Box2D.Dynamics.b2BodyDef;
    var b2Body = Box2D.Dynamics.b2Body;
    var b2FixtureDef = Box2D.Dynamics.b2FixtureDef;
    var b2Fixture = Box2D.Dynamics.b2Fixture;
    var b2World = Box2D.Dynamics.b2World;
    var b2MassData = Box2D.Collision.Shapes.b2MassData;
    var b2PolygonShape = Box2D.Collision.Shapes.b2PolygonShape;
    var b2CircleShape = Box2D.Collision.Shapes.b2CircleShape;
    var b2DebugDraw = Box2D.Dynamics.b2DebugDraw;
    var b2AABB = Box2D.Collision.b2AABB;
    
    /**
     * @_module boxbox
     * @params canvas, [options]
     * @canvas element to render on
     * @options
     * <ul>
     * @gravity (default 10) can be negative
     * @allowSleep (default true) bodies may sleep when they come to
     *     rest. a sleeping body is no longer being simulated, which can
     *     improve performance.
     * @scale (default 30) scale for rendering in pixels / meter
     * </ul>
     * @return a new <a href="#name-World">World</a>
     * @description
     without options
     <code>var canvasElem = document.getElementById("myCanvas");
     var world = boxbox.createWorld(canvasElem);</code>
     with options
     <code>var canvasElem = document.getElementById("myCanvas");
     var world = boxbox.createWorld(canvasElem, {
     &nbsp;&nbsp;gravity: 20,
     &nbsp;&nbsp;scale: 60
     });</code>
     */
    this.createWorld = function(canvas, options) {
        var world = create(World);
        world._init(canvas, options);
        return world;
    };
    
    var WORLD_DEFAULT_OPTIONS = {
        gravity: 10,
        allowSleep: true,
        scale: 30
    };
    
    var JOINT_DEFAULT_OPTIONS = {
        type: "distance",
        allowCollisions: false
    };

    /**
     * @header
     * @description contains a single self-contained physics simulation
     */
    var World = {
        
        _ops: null,
        _world: null,
        _canvas: null,
        _keydownHandlers: {},
        _keyupHandlers: {},
        _startContactHandlers: {},
        _finishContactHandlers: {},
        _impactHandlers: {},
        _destroyQueue: [],
        _impulseQueue: [],
        _constantVelocities: {},
        _constantForces: {},
        _entities: {},
        _nextEntityId: 0,
        _cameraX: 0,
        _cameraY: 0,
        _onRender: [],
        
        _init: function(canvasElem, options) {
            var self = this;
            var key;
            var i;
            var world;
            var listener;
            this._ops = extend(options, WORLD_DEFAULT_OPTIONS);
            this._world = new b2World(new b2Vec2(0, this._ops.gravity), true);
            world = this._world;
            this._canvas = canvasElem;
            this._ctx = this._canvas.getContext("2d");
            this._scale = this._ops.scale;
            
            // Set up rendering on the provided canvas
            if (this._canvas !== undefined) {
                
                // debug rendering
                if (this._ops.debugDraw) {
                    var debugDraw = new b2DebugDraw();
                    debugDraw.SetSprite(this._canvas.getContext("2d"));
                    debugDraw.SetDrawScale(this._scale); // TODO update this if changed?
                    debugDraw.SetFillAlpha(0.3);
                    debugDraw.SetLineThickness(1.0);
                    debugDraw.SetFlags(b2DebugDraw.e_shapeBit | b2DebugDraw.e_jointBit);
                    world.SetDebugDraw(debugDraw);
                }
                
                // animation loop
                (function animationLoop(){

                    var key;
                    var entity;

                    // set velocities for this step
                    for (key in self._constantVelocities) {
                        var v = self._constantVelocities[key];
                        v.body.SetLinearVelocity(new b2Vec2(v.x, v.y),
                                                 v.body.GetWorldCenter());
                    }

                    // apply impulses for this step
                    for (i = 0; i < self._impulseQueue.length; i++) {
                        var impulse = self._impulseQueue.pop();
                        impulse.body.ApplyImpulse(new b2Vec2(impulse.x, impulse.y),
                                                  impulse.body.GetWorldCenter());
                    }               
                    
                    // set forces for this step
                    for (key in self._constantForces) {
                        var f = self._constantForces[key];
                        f.body.ApplyForce(new b2Vec2(f.x, f.y),
                                          f.body.GetWorldCenter());
                    }
                    
                    // destroy
                    for (i = 0; i < self._destroyQueue.length; i++) {
                        var toDestroy = self._destroyQueue.pop();
                        var id = toDestroy._id;
                        world.DestroyBody(toDestroy._body);
                        delete self._keydownHandlers[id];
                        delete self._startContactHandlers[id];
                        delete self._finishContactHandlers[id];
                        delete self._impactHandlers[id];
                        delete self._destroyQueue[id];
                        delete self._impulseQueue[id];
                        delete self._constantVelocities[id];
                        delete self._constantForces[id];
                        delete self._entities[id];
                    }
                    
                    // framerate, velocity iterations, position iterations
                    world.Step(1 / 60, 10, 10);
                    
                    
                    
                    // render stuff
                    self._canvas.width = self._canvas.width;
                    for (key in self._entities) {
                      entity = self._entities[key];
                      entity._draw(self._ctx,
                                   entity._body.m_xf.position.x,
                                   entity._body.m_xf.position.y);
                    }
                    for (i = 0; i < self._onRender.length; i++) {
                      self._onRender[i].call(self, self._ctx);
                    }
                    
                    world.ClearForces();
                    world.DrawDebugData();

                    // TODO paul irish shim
                    window.requestAnimFrame(animationLoop);
                }());
                
                // keyboard events
                window.addEventListener('keydown', function(e) {
                    for (var key in self._keydownHandlers) {
                        self._keydownHandlers[key].call(self._entities[key], e);
                    }
                }, false);
                window.addEventListener('keyup', function(e) {
                    for (var key in self._keyupHandlers) {
                        self._keyupHandlers[key].call(self._entities[key], e);
                    }
                }, false);

                // contact events
                listener = new Box2D.Dynamics.b2ContactListener();
                listener.BeginContact = function(contact) {
                    var a = self._entities[contact.GetFixtureA().GetBody()._bbid];
                    var b = self._entities[contact.GetFixtureB().GetBody()._bbid];
                    for (var key in self._startContactHandlers) {
                        if (a._id === Number(key)) {
                            self._startContactHandlers[key].call(self._entities[key], b);
                        }
                        if (b._id === Number(key)) {
                            self._startContactHandlers[key].call(self._entities[key], a);
                        }
                    }
                };
                listener.EndContact = function(contact) {
                    var a = self._entities[contact.GetFixtureA().GetBody()._bbid];
                    var b = self._entities[contact.GetFixtureB().GetBody()._bbid];
                    for (var key in self._finishContactHandlers) {
                        if (a._id === Number(key)) {
                            self._finishContactHandlers[key].call(self._entities[key], b);
                        }
                        if (b._id === Number(key)) {
                            self._finishContactHandlers[key].call(self._entities[key], a);
                        }
                    }
                };
                listener.PostSolve = function(contact, impulse) {
                    var a = self._entities[contact.GetFixtureA().GetBody()._bbid];
                    var b = self._entities[contact.GetFixtureB().GetBody()._bbid];
                    
                    for (var key in self._impactHandlers) {
                        if (a._id === Number(key)) {
                            self._impactHandlers[key].call(self._entities[key],
                                                           b,
                                                           impulse.normalImpulses[0],
                                                           impulse.tangentImpulses[0]);
                        }
                        if (b._id === Number(key)) {
                            self._impactHandlers[key].call(self._entities[key],
                                                           a,
                                                           impulse.normalImpulses[0],
                                                           impulse.tangentImpulses[0]);
                        }
                    }
                };
                world.SetContactListener(listener);
            }
        },
        
        _addKeydownHandler: function(id, f) {
            this._keydownHandlers[id] = f;
        },
        
        _addKeyupHandler: function(id, f) {
            this._keyupHandlers[id] = f;
        },

        _addStartContactHandler: function(id, f) {
            this._startContactHandlers[id] = f;
        },
        
        _addFinishContactHandler: function(id, f) {
            this._finishContactHandlers[id] = f;
        },

        _addImpactHandler: function(id, f) {
            this._impactHandlers[id] = f;
        },
        
        _destroy: function(obj) {
            this._destroyQueue.push(obj);
        },

        _applyImpulse: function(id, body, x, y) {
          this._impulseQueue.push({
                id:id,
                body:body,
                x:x,
                y:y
            });
        },
        
        _setConstantVelocity: function(name, id, body, x, y) {
            this._constantVelocities[name + id] = {
                id:id,
                body:body,
                x:x,
                y:y
            };
        },
        
        _clearConstantVelocity: function(name, id) {
            delete this._constantVelocities[name + id];
        },

        _setConstantForce: function(name, id, body, x, y) {
            this._constantForces[name + id] = {
                id:id,
                body:body,
                x:x,
                y:y
            };
        },
        
        _clearConstantForce: function(name, id) {
            delete this._constantForces[name + id];
        },

        /**
         * @_module world
         * @_params [value]
         * @value: {x,y}
         * @return: {x,y}
         * @description get or set the world's gravity
         */
        gravity: function(value) {
            if (value !== undefined) {
                this._world.SetGravity(new b2Vec2(0, value));
            }
            var v = this._world.GetGravity();
            return {x: v.x, y: v.y};
        },
        
        /**
         * @_module world
         * @_params options
         * @options
         * <ul>
         * @x starting x coordinate
         * @y starting y coordinate
         * @type 'dynamic' or 'static'. static objects can't move
         * @shape 'square' or 'circle' or 'polygon'
         * @height for box (default 1)
         * @width for box (default 1)
         * @radius for circle (default 1)
         * @points for polygon [{x,y}, {x,y}, {x,y}] must go clockwise
         * must be convex
         * @density (default 2)
         * @friction (default 1)
         * @restitution or bounciness (default .2)
         * @active (default true) participates in collisions and dynamics
         * @fixedRotation (default false)
         * @bullet (default false) perform expensive continuous
         * collision detection
         * @image file for rendering
         * @imageOffsetX (default 0) for image
         * @imageOffsetY (default 0) for image
         * @imageStretchToFit (default false) for image
         * @color CSS color for rendering if no image is given (default 'gray')
         * @draw custom draw function, params are context, x, and y
         * </ul>
         * @return a new <a href="#name-Entity">Entity</a>
         * @description
         Example:
         <code>var player = world.createEntity({
         &nbsp;&nbsp;name: "player",
         &nbsp;&nbsp;shape: "circle",
         &nbsp;&nbsp;radius: 2
         });</code>
         You can pass multiple options objects. This allows for "templates"
         with reusable defaults:
         <code>var redCircleTemplate = {color: "red", shape: "circle", radius: 3};
         world.createEntity(redCircleTemplate, {x: 5, y: 5});
         world.createEntity(redCircleTemplate, {x: 10, y: 5});</code>
         The options objects on the right take precedence.
         */
        createEntity: function() {
            var o = {};
            var args = Array.prototype.slice.call(arguments);
            args.reverse();
            for (var key in args) {
                extend(o, args[key]);
            }
            var entity = create(Entity);
            var id = this._nextEntityId++;
            entity._init(this, o, id);
            this._entities[id] = entity;
            return entity;
        },
        
        /**
         * @_module world
         * @_params entity1, entity2, [options]
         * @entity1 Entity on one side of the joint
         * @entity2 Entity on the other side of the joint
         * @options
         * <ul>
         * @enableMotor (default false)
         * @type one of
         * <ul>
         * @distance these entities will always remain the same distance apart
         * @revolute
         * @gear
         * @friction
         * @prismatic
         * @weld
         * @pulley
         * @mouse
         * @line
         * </ul>
         * </ul>
         * @description Experimental joint support.
         * See <a href="http://box2d.org/">box2d documentation</a> for more
         * info.
         */
        createJoint: function(entity1, entity2, options) {
            options = options || {};
            options = extend(options, JOINT_DEFAULT_OPTIONS);
            var type = options.type;
            
            var joint;
            
            if (type === "distance") {
                joint = new Box2D.Dynamics.Joints.b2DistanceJointDef();
            }
            else if (type === "revolute") {
                joint = new Box2D.Dynamics.Joints.b2RevoluteJointDef();
            }
            else if (type === "gear") {
                joint = new Box2D.Dynamics.Joints.b2GearJointDef();
            }
            else if (type === "friction") {
                joint = new Box2D.Dynamics.Joints.b2FrictionJointDef();
            }
            else if (type === "prismatic") {
                joint = new Box2D.Dynamics.Joints.b2PrismaticJointDef();
            }
            else if (type === "weld") {
                joint = new Box2D.Dynamics.Joints.b2WeldJointDef();
            }
            else if (type === "pulley") {
                joint = new Box2D.Dynamics.Joints.b2PulleyJointDef();
            }
            else if (type === "mouse") {
                joint = new Box2D.Dynamics.Joints.b2MouseJointDef();
            }
            else if (type === "line") {
                joint = new Box2D.Dynamics.Joints.b2LineJointDef();
            }
            
            if (options.enableMotor) {
                joint.enableMotor = true;
            }
            
            var jointPositionOnEntity1 = entity1._body.GetWorldCenter();
            if (options.jointPositionOnEntity1) {
                jointPositionOnEntity1.x += options.jointPositionOnEntity1.x;
                jointPositionOnEntity1.y += options.jointPositionOnEntity1.y;
            }
            
            var jointPositionOnEntity2 = entity2._body.GetWorldCenter();
            if (options.jointPositionOnEntity2) {
                jointPositionOnEntity2.x += options.jointPositionOnEntity2.x;
                jointPositionOnEntity2.y += options.jointPositionOnEntity2.y;
            }
            
            if (type === "mouse") {
                joint.bodyA = entity1._body;
                joint.bodyB = entity2._body;
            }
            else if (joint.Initialize) {
                joint.Initialize(entity1._body,
                                 entity2._body,
                                 jointPositionOnEntity1,
                                 jointPositionOnEntity2);
            }
            if (options.allowCollisions) {
                joint.collideConnected = true;
            }
            this._world.CreateJoint(joint);
        },

        /**
         * @_module world
         * @x1 upper left of query box
         * @y1 upper left of query box
         * @x2 lower right of query box
         * @y2 lower right of query box
         * @return array of Entities. may be empty
         * @description find Entities in a given query box
         */
        find: function(x1, y1, x2, y2) {
            if (x2 === undefined) {
                x2 = x1;
            }
            if (y2 === undefined) {
                y2 = y1;
            }
            var self = this;
            var result = [];
            var aabb = new b2AABB();
            aabb.lowerBound.Set(x1, y1);
            aabb.upperBound.Set(x2, y2);
            this._world.QueryAABB(function(fixt) {
                result.push(self._entities[fixt.GetBody()._bbid]);
                return true;
            }, aabb);
            return result;
        },
        
        /**
         * @_module world
         * @_params [value]
         * @value {x,y}
         * @return {x,y}
         * @description get or set position of camera
         */
        camera: function(v) {
            v = v || {};
            if (v.x === undefined && v.y === undefined) {
                return {x:this._cameraX, y: this._cameraY};
            }
            if (v.x !== undefined) {
                this._cameraX = v.x;
            }
            if (v.y !== undefined) {
                this._cameraY = v.y;
            }
        },
        
        /**
         * @_module world
         * @callback function( context )
         * <ul>
         * @context canvas context for rendering
         * @this World
         * </ul>
         * @description Add an onRender callback to the World
         * This is useful for custom rendering. For example, to draw text
         * on every frame:
         * <code>world.onRender(function(ctx) {
         *   ctx.fillText("Score: " + score, 10, 10);
         * });</code>
         * This callback occurs after all entities have been rendered on the
         * frame.
         * <br>
         * Multiple onRender callbacks can be added, and they can be removed
         * with unbindOnRender.
         */
        onRender: function(callback) {
            this._onRender.push(callback);
        },
        
        /**
         * @_module world
         * @callback callback
         * @description
         * If the provided function is currently an onRender callback for this
         * World, it is removed.
         */
        unbindOnRender: function(callback) {
            var newArray = [];
            var i;
            for (i = 0; i < this._onRender.length; i++) {
              if (this._onRender[i] !== callback) {
                newArray.push(this._onRender[i]);
              }
            }
            this._onRender = newArray;
        },
        
        /**
         * @_module world
         * @_params [value]
         * @value number
         * @return number
         * @description get or set the scale for rendering in pixels / meter
         */
        scale: function(s) {
            if (s !== undefined) {
                this._scale = s;
                // TODO update debug draw?
            }
            return this._scale;
        }
        
    };
    
    var ENTITY_DEFAULT_OPTIONS = {
        name: 'unnamed object',
        x: 10,
        y: 5,
        type: 'dynamic', // or static
        shape: 'square', // or circle or polygon
        height: 1, // for box
        width: 1, // for box
        radius: 1, // for circle
        points: [{x:0, y:0}, // for polygon
                 {x:2, y:0},
                 {x:0, y:2}],
        density: 2,
        friction: 1,
        restitution: 0.2, // bounciness
        active: true, // participates in collision and dynamics
        fixedRotation: false,
        bullet: false, // perform expensive continuous collision detection
        image: null,
        imageOffsetX: 0,
        imageOffsetY: 0,
        imageStretchToFit: null,
        color: 'gray',
        draw: function(ctx, x, y) {
            var cameraOffsetX = -this._world._cameraX;
            var cameraOffsetY = -this._world._cameraY;
            ctx.fillStyle = this._ops.color;
            ctx.strokeStyle = 'black';
            var i;
            var scale = this._world._scale;
            var ox = this._ops.imageOffsetX || 0;
            var oy = this._ops.imageOffsetY || 0;
            if (this._sprite !== undefined) {
                var width;
                var height;
                if (this._ops.shape === "circle" && this._ops.imageStretchToFit) {
                    width = height = this._ops.radius * 2;
                    x -= this._ops.radius / 2;
                    y -= this._ops.radius / 2;
                }
                else if (this._ops.imageStretchToFit) {
                    width = this._ops.width * 2;
                    height = this._ops.height * 2;
                }
                else {
                    width = this._sprite.width / 30;
                    height = this._sprite.height / 30;
                }

                var tx = ox + (cameraOffsetX + x + width / 4) * scale;
                var ty = oy + (cameraOffsetY + y + height / 4) * scale;
                
                ctx.translate(tx, ty);
                
                ctx.rotate(this._body.GetAngle());
                
                ctx.drawImage(this._sprite,
                              -(width / 2 * scale),
                              -(height / 2 * scale),
                              width * scale,
                              height * scale);
                              
                ctx.rotate(0 - this._body.GetAngle());              
                              
                ctx.translate(-tx, -ty);

            }
            else if (this._ops.shape === 'polygon' || this._ops.shape === 'square') {
                var poly = this._body.GetFixtureList().GetShape();
                var vertexCount = parseInt(poly.GetVertexCount(), 10);
                var localVertices = poly.GetVertices();
                var vertices = new Vector(vertexCount);
                var xf = this._body.m_xf;
                for (i = 0; i < vertexCount; ++i) {
                   vertices[i] = b2Math.MulX(xf, localVertices[i]);
                }
                ctx.beginPath();
                ctx.moveTo((cameraOffsetX + vertices[0].x) * scale, (cameraOffsetY + vertices[0].y) * scale);
                for (i = 1; i < vertices.length; i++) {
                    ctx.lineTo((cameraOffsetX + vertices[i].x) * scale, (cameraOffsetY + vertices[i].y) * scale);
                }
                ctx.closePath();
                ctx.stroke();
                ctx.fill();
            }
            else if (this._ops.shape === 'circle') {
                var p = this.position();
                ctx.beginPath();
                ctx.arc((cameraOffsetX + p.x) * scale,
                        (cameraOffsetY + p.y) * scale,
                        this._ops.radius * scale,
                        0,
                        Math.PI * 2, true);
                ctx.closePath();
                ctx.stroke();
                ctx.fill();
            }
        }
    };
    
    /**
     * @header
     * @description a single physical object in the physics simulation
     */
    var Entity = {
        
        _id: null,
        _ops: null,
        _body: null,
        _world: null,
        
        _init: function(world, options, id) {
            this._ops = extend(options, ENTITY_DEFAULT_OPTIONS);
            var ops = this._ops;
            
            this._body = new b2BodyDef();
            var body = this._body;
            
            this._world = world;
            this._id = id;
            
            var fixture = new b2FixtureDef();
            fixture.density = ops.density;
            fixture.friction = ops.friction;
            fixture.restitution = ops.restitution;
            
            body.position.x = ops.x;
            body.position.y = ops.y;
            
            this._name = ops.name;

            // type
            if (ops.type === 'static') {
                body.type = b2Body.b2_staticBody;
            }
            else if (ops.type === 'dynamic') {
                body.type = b2Body.b2_dynamicBody;
            }
            
            // shape
            if (ops.shape === 'square') {
                fixture.shape = new b2PolygonShape();
                fixture.shape.SetAsBox(ops.width, ops.height);
            }
            else if (ops.shape === 'circle') {
                fixture.shape = new b2CircleShape(ops.radius);
            }
            else if (ops.shape === 'polygon') {
                fixture.shape = new b2PolygonShape();
                fixture.shape.SetAsArray(ops.points, ops.points.length);
            }
            
            // rendering stuff
            if (ops.draw) {
                this._draw = ops.draw;
            }
            if (ops.image) {
                this._sprite = new Image();
                this._sprite.src = ops.image;
            }
            
            body.active = ops.active;
            body.fixedRotation = ops.fixedRotation;
            body.bullet = ops.bullet;
            
            this._body = world._world.CreateBody(body); 
            this._body.CreateFixture(fixture);
            this._body._bbid = id;
            
            // events
            if (ops.onStartContact) {
                this._world._addStartContactHandler(id, ops.onStartContact);
            }
            if (ops.onFinishContact) {
                this._world._addFinishContactHandler(id, ops.onFinishContact);
            }
            if (ops.onImpact) {
                this._world._addImpactHandler(id, ops.onImpact);
            }
        },
        
        // returns a vector. params can be either of the following:
        // power, x, y
        // power, degrees
        _toVector: function(power, a, b) {
            var x;
            var y;
            a = a || 0;
            if (b === undefined) {
                a -= 90;
                x = Math.cos(a * (Math.PI / 180)) * power;
                y = Math.sin(a * (Math.PI / 180)) * power;
            }
            else {
                x = a * power;
                y = b * power;
            }
            return {x:x,y:y};
        },
        
        /**
         * @_module entity
         * @return entity name
         */
        name: function() {
          return this._name;
        },
        
        /**
         * @_module entity
         * @_params [value]
         * @value {x,y}
         * @return {x,y}
         * @description get or set entity position
         */
        position: function(value) {
            if (value !== undefined) {
                this._body.SetPosition(new b2Vec2(value.x, value.y));
            }
            var p = this._body.GetPosition();
            return {x: p.x, y: p.y};
        },
        
        /**
         * @_module entity
         * @_params
         * @return {x,y}
         * @description Get the Entity position in pixels. Useful for custom
         * rendering. Unlike <a href="#name-Position">position</a> the result
         * is relative to the World's scale and camera position.
         */
        canvasPosition: function(value) {
            if (value !== undefined) {
                // TODO set
            }
            
            var p = this.position();
            var c = this._world.camera();
            var s = this._world.scale();
            
            return {
                x: Math.round((p.x + -c.x) * s),
                y: Math.round((p.y + -c.y) * s)
            };
        },
        
        /**
         * @_module entity
         * @_params [value]
         * @value degrees
         * @return degrees
         * @description get or set entity rotation
         */
        rotation: function(value) {
            if (value !== undefined) {
                this._body.SetAngle(value);
            }
            return this._body.GetAngle();
        },
        
        /**
         * @_module entity
         * @_params [value]
         * @value number
         * @return number
         * @description get or set entity friction
         */
        friction: function(value) {
            if (value !== undefined) {
                this._body.GetFixtureList().SetFriction(value);
            }
            return this._body.GetFixtureList().GetFriction();
        },
        
        /**
         * @_module entity
         * @description destroy this entity and remove it from the world
         */
        destroy: function() {
            this._destroyed = true;
            this._world._destroy(this);
        },

        /**
         * @_module entity
         * @power of impulse
         * @degrees direction of force. 0 is up, 90 is right, etc.
         * @_params power, degrees
         * @description Apply an instantanious force on this Entity.
         * <br>
         * With this and all functions that take degrees, you can also provide
         * a vector.
         * <code>entity.applyImpulse(10, 45); // 45 degree angle
         * entity.applyImpulse(10, 1, -1); // the vector x=1 y=-1}</code>
         */
        applyImpulse: function(power, a, b) {
            var v = this._toVector(power, a, b);
            this._world._applyImpulse(this._id, this._body, v.x, v.y);
        },
        
        /**
         * @_module entity
         * @name of force
         * @power of force
         * @degrees direction of force
         * @_params name, power, degrees
         * @description Apply a constant force on this Entity. Can be removed later
         * using clearForce.
         */
        setForce: function(name, power, a, b) {
            var v = this._toVector(power, a, b);
            this._world._setConstantForce(name, this._id, this._body, v.x, v.y);
        },
        
        /**
         * @_module entity
         * @name of velocity
         * @power of velocity
         * @degrees direction of velocity
         * @_params name, power, degrees
         * @description Continuously override velocity of this Entity. Can be removed later
         * using clearVelocity.
         */
        setVelocity: function(name, power, a, b) {
            var v = this._toVector(power, a, b);
            this._world._setConstantVelocity(name, this._id, this._body, v.x, v.y);
        },

        /**
         * @_module entity
         * @description Stop the force with the given name.
         */
        clearForce: function(name) {
            this._world._clearConstantForce(name, this._id);
        },

        /**
         * @_module entity
         * @description Stop the constant velocity with the given name.
         */
        clearVelocity: function(name) {
            this._world._clearConstantVelocity(name, this._id);
        },
        
        /**
         * @_module entity
         * @callback function( e )
         * <ul>
         * @e keydown event
         * @this this Entity
         * </ul>
         * @description Handle keydown event for this entity.
         */
        onKeydown: function(callback) {
            this._world._addKeydownHandler(this._id, callback);
        },
        
        /**
         * @_module entity
         * @callback function( e )
         * <ul>
         * @e keyup event
         * @this this Entity
         * </ul>
         * @description Handle keyup event for this entity.
         */
        onKeyup: function(callback) {
            this._world._addKeyupHandler(this._id, callback);
        },

        /**
         * @_module entity
         * @callback function( entity )
         * <ul>
         * @entity that contact started with
         * @this this Entity
         * </ul>
         * @description Handle start of contact with another entity.
         */
        onStartContact: function(callback) {
            this._world._addStartContactHandler(this._id, callback);
        },

        /**
         * @_module entity
         * @callback function( entity )
         * <ul>
         * @entity that contact ended with
         * @this this Entity
         * </ul>
         * @description Handle end of contact with another entity.
         */
        onFinishContact: function(callback) {
            this._world._addFinishContactHandler(this._id, callback);
        },

        /**
         * @_module entity
         * @callback function( entity, normalForce, tangentialForce )
         * <ul>
         * @entity collided with
         * @normalForce force of two entities colliding
         * @tangentialForce force of two entities "rubbing" up against each other
         * @this this Entity
         * </ul>
         * @description Handle impact with another entity.
         */
        onImpact: function(callback) {
            this._world._addImpactHandler(this._id, callback);
        }
        
    };
    
    return this;

}());