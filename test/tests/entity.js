module("Entity", {
    setup: function() {
        this.canvasElem = document.createElement("canvas");
        document.body.appendChild(this.canvasElem);
        this.world = boxbox.createWorld(this.canvasElem);
    },
    teardown: function() {
        document.body.removeChild(this.canvasElem);
    }
});

test("Square creation", function() {

    var ent, returnVal, shapeStub, setAsBoxSpy;
    returnVal = new Box2D.Collision.Shapes.b2PolygonShape();
    shapeStub = sinon.stub(Box2D.Collision.Shapes, "b2PolygonShape");
    setAsBoxSpy = sinon.spy(returnVal, "SetAsBox");
    shapeStub.returns(returnVal);

    ent = this.world.createEntity({
        shape: "square",
        width: 23,
        height: 45
    });

    ok(setAsBoxSpy.calledOnce, "Invokes the 'SetAsBox' method");
    // box2d uses half the width / height
    deepEqual(setAsBoxSpy.firstCall.args, [11.5, 22.5],
        "Calls with the specified dimensions");

    shapeStub.restore();
});

test("Circle creation", function() {

    var ent, returnVal, shapeSpy;
    returnVal = new Box2D.Collision.Shapes.b2PolygonShape();
    shapeSpy = sinon.spy(Box2D.Collision.Shapes, "b2CircleShape");

    ent = this.world.createEntity({
        shape: "circle",
        radius: 91
    });

    ok(shapeSpy.calledOnce, "Invokes the 'b2CircleShape' method");
    deepEqual(shapeSpy.firstCall.args, [91],
        "Calls with the specified radius");

    shapeSpy.restore();
});

test("Polygon creation", function() {

    var ent, returnVal, shapeStub, setAsArraySpy, points;
    returnVal = new Box2D.Collision.Shapes.b2PolygonShape();
    shapeStub = sinon.stub(Box2D.Collision.Shapes, "b2PolygonShape");
    setAsArraySpy = sinon.spy(returnVal, "SetAsArray");
    shapeStub.returns(returnVal);


    points = [{ x: 0, y: 1 }, { x: 1, y: 0 }, { x: -1, y: -1}];
    ent = this.world.createEntity({
        shape: "polygon",
        points: points
    });

    ok(setAsArraySpy.calledOnce, "Invokes the 'SetAsArray' method");
    deepEqual(setAsArraySpy.firstCall.args, [points, points.length],
        "Calls with the specified points");

    shapeStub.restore();
});
