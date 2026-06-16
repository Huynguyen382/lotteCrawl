import React, { useEffect, useRef, useState, useCallback } from 'react';
import Matter from 'matter-js';
import './LotteryCage.css';

function LotteryCage({ game }) {
  const sceneRef = useRef(null);
  const engineRef = useRef(null);
  const renderRef = useRef(null);
  const runnerRef = useRef(null);
  const cageRef = useRef(null);
  
  const [power, setPower] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const reqRef = useRef(null);

  // Constants
  const width = 800;
  const height = 700;
  const cx = width / 2;
  const cy = height / 2;
  const cageRadius = 300;

  // Cleanup & Setup Physics
  useEffect(() => {
    const Engine = Matter.Engine;
    const Render = Matter.Render;
    const Runner = Matter.Runner;
    const Bodies = Matter.Bodies;
    const Composite = Matter.Composite;
    const Body = Matter.Body;
    const Constraint = Matter.Constraint;
    const Events = Matter.Events;

    // Create engine
    const engine = Engine.create();
    engineRef.current = engine;
    
    // Set slightly lower gravity for floating effect
    engine.gravity.y = 0.8;

    // Create renderer
    const render = Render.create({
      element: sceneRef.current,
      engine: engine,
      options: {
        width,
        height,
        wireframes: false,
        background: 'transparent'
      }
    });
    renderRef.current = render;

    // --- BUILD THE CAGE (Hollow Circle) ---
    const parts = [];
    const sides = 40; // Number of segments
    const partLength = (Math.PI * 2 * cageRadius) / sides + 5; // +5 to overlap slightly
    
    for (let i = 0; i < sides; i++) {
      const theta = (Math.PI * 2 / sides) * i;
      const x = cx + cageRadius * Math.cos(theta);
      const y = cy + cageRadius * Math.sin(theta);
      
      const part = Bodies.rectangle(x, y, partLength, 20, {
        angle: theta,
        isStatic: false,
        render: {
          fillStyle: 'rgba(69, 123, 157, 0.4)',
          strokeStyle: 'rgba(168, 218, 220, 0.8)',
          lineWidth: 1
        }
      });
      parts.push(part);
    }

    // Group the parts into a single compound body
    const cage = Body.create({
      parts: parts,
      isStatic: false,
      friction: 0.1,
      restitution: 0.2 // Minimal bounce on the cage walls
    });
    cageRef.current = cage;

    // Pin the cage to the center so it can rotate but not fall
    const pin = Constraint.create({
      pointA: { x: cx, y: cy },
      bodyB: cage,
      pointB: { x: 0, y: 0 },
      stiffness: 1,
      length: 0,
      render: { visible: false }
    });

    Composite.add(engine.world, [cage, pin]);

    // --- CREATE BALLS ---
    const maxBalls = game === '645' ? 45 : (game === '655' ? 55 : 35);
    const balls = [];
    
    for (let i = 1; i <= maxBalls; i++) {
      // Random position inside the cage top half
      const bx = cx + (Math.random() - 0.5) * 200;
      const by = cy - 100 + (Math.random() - 0.5) * 100;
      
      const ball = Bodies.circle(bx, by, 18, {
        restitution: 0.85, // Bouncy balls
        friction: 0.005,
        density: 0.04,
        label: `Ball-${i}`,
        render: {
          visible: false // We will custom render them for 3D effect
        }
      });
      ball.ballNumber = i; // Custom property
      balls.push(ball);
    }

    Composite.add(engine.world, balls);

    // --- CUSTOM PSEUDO-3D RENDERER ---
    Events.on(render, 'afterRender', function() {
      const context = render.context;
      const allBodies = Composite.allBodies(engine.world);
      
      for (let body of allBodies) {
        if (body.label && body.label.startsWith('Ball-')) {
          const num = body.ballNumber;
          const { x, y } = body.position;
          const r = body.circleRadius;
          
          context.beginPath();
          context.arc(x, y, r, 0, 2 * Math.PI);
          
          // Radial gradient for 3D sphere look
          const gradient = context.createRadialGradient(x - r/3, y - r/3, r/10, x, y, r);
          gradient.addColorStop(0, '#ff9a9e');
          gradient.addColorStop(0.3, '#e63946'); 
          gradient.addColorStop(1, '#900c14'); // Dark shadow on the edge
          
          context.fillStyle = gradient;
          context.fill();
          
          // Border
          context.lineWidth = 1;
          context.strokeStyle = '#60050b';
          context.stroke();
          
          // Draw number
          context.fillStyle = 'white';
          context.font = 'bold 16px "Plus Jakarta Sans", sans-serif';
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          
          // Rotate text with the physical ball
          context.save();
          context.translate(x, y);
          context.rotate(body.angle);
          // Add a slight drop shadow to text for readability
          context.shadowColor = "rgba(0,0,0,0.5)";
          context.shadowBlur = 2;
          context.shadowOffsetX = 1;
          context.shadowOffsetY = 1;
          context.fillText(num, 0, 0);
          context.restore();
        }
      }
    });

    // Run the engine
    Render.run(render);
    const runner = Runner.create();
    Runner.run(runner, engine);
    runnerRef.current = runner;

    // Cleanup on unmount
    return () => {
      Render.stop(render);
      Runner.stop(runner);
      render.canvas.remove();
      render.canvas = null;
      render.context = null;
      render.textures = {};
    };
  }, [game]); // Re-init when game changes

  // --- POWER BAR LOGIC ---
  const updatePower = useCallback(() => {
    if (isHolding) {
      setPower((prev) => {
        const next = prev + 3; // Speed of power increase
        return next > 254 ? 254 : next;
      });
      reqRef.current = requestAnimationFrame(updatePower);
    }
  }, [isHolding]);

  useEffect(() => {
    if (isHolding) {
      reqRef.current = requestAnimationFrame(updatePower);
    } else {
      cancelAnimationFrame(reqRef.current);
    }
    return () => cancelAnimationFrame(reqRef.current);
  }, [isHolding, updatePower]);

  // Handle global Spacebar
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        startCharging();
      }
    };
    
    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        releaseCharge();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const startCharging = () => {
    setPower(0);
    setIsHolding(true);
  };

  const releaseCharge = () => {
    setIsHolding(false);
    spinCage();
  };

  const spinCage = () => {
    if (cageRef.current && power > 0) {
      const MatterBody = Matter.Body;
      // Convert power (0-254) to angular velocity
      // Using a formula to make it spin nicely (e.g. max velocity ~ 0.5)
      const angularVel = (power / 254) * 0.4;
      
      // Randomize direction sometimes or just always clockwise
      const direction = 1; // 1 or -1
      
      MatterBody.setAngularVelocity(cageRef.current, direction * angularVel);
    }
  };

  const resetCage = () => {
    if (cageRef.current) {
      Matter.Body.setAngularVelocity(cageRef.current, 0);
    }
    setPower(0);
  };

  const powerPercent = (power / 254) * 100;

  return (
    <div className="cage-container fade-in">
      <div className="cage-header">
        <h3>Lồng Quay Vật Lý Học 3D</h3>
        <p>Nhấn giữ phím Space hoặc nút bên dưới để tăng lực quay lồng.</p>
      </div>

      <div className="power-section">
        <div className="power-info">
          <span>Lực Xoay (Power)</span>
          <span className="value">{Math.round(power)} / 254</span>
        </div>
        <div className="power-bar-track">
          <div 
            className="power-bar-fill" 
            style={{ width: `${powerPercent}%` }}
          ></div>
        </div>
        
        <div className="action-controls">
          <button 
            className="btn-spin"
            onMouseDown={startCharging}
            onMouseUp={releaseCharge}
            onMouseLeave={() => { if(isHolding) releaseCharge() }}
            onTouchStart={startCharging}
            onTouchEnd={releaseCharge}
          >
            Nhấn Giữ Lực
          </button>
          <button className="btn-reset" onClick={resetCage}>
            Phanh Dừng Lồng
          </button>
        </div>
      </div>

      <div className="canvas-wrapper">
        <div ref={sceneRef} />
        {/* The glass overlay creates the illusion of looking through a glass sphere */}
        <div className="glass-overlay"></div>
      </div>
    </div>
  );
}

export default LotteryCage;
