/*
The dog will:
 - Usually follow the player (unless player is out of bounds)
 - Randomly sit or idle
 - Sit on command
 - Go eat on command
*/

import * as DCL from 'metaverse-api'
import {Vector3, Quaternion} from "babylonjs";

enum Goal
{
  Idle,
  Sit,
  Follow,
  GoEat,
  Eating,
}

export interface IState 
{
  characterPosition: Vector3, 
  bowlPosition: Vector3,
  dogGoal: Goal,
  dogPreviousGoal: Goal,
  dogPosition: Vector3,
  dogRotation: Quaternion,
  dogAnimationWeight: number
}

export default class SampleScene extends DCL.ScriptableScene
{
  state = {
    characterPosition: new Vector3(0, 0, 0),
    bowlPosition: new Vector3(1, 0, 1),
    dogGoal: Goal.Idle,
    dogPreviousGoal: Goal.Idle,
    dogPosition: new Vector3(9, 0, 9),
    dogRotation: new Quaternion(0, 0, 0, 1),
    dogAnimationWeight: 1,
  };

  sceneDidMount()
  {
    this.eventSubscriber.on("Dog_click", () =>
    {
      this.setDogGoal(this.state.dogGoal == Goal.Sit ? Goal.Idle : Goal.Sit);
    });

    this.eventSubscriber.on("Bowl_click", () =>
    {
      this.setDogGoal(Goal.GoEat);
    });

    setInterval(() => 
    {
      const weight = Math.min(Math.max(this.state.dogAnimationWeight, 0), 1);
      this.setState({dogAnimationWeight: weight + .01});

      switch(this.state.dogGoal)
      {
        case Goal.Follow:
        case Goal.GoEat:
          const targetLocation = this.state.dogGoal == Goal.Follow ? this.state.characterPosition : this.state.bowlPosition;
          let delta = targetLocation.subtract(this.state.dogPosition);
          if(delta.lengthSquared() < 2) 
          {
            this.setDogGoal(this.state.dogGoal == Goal.Follow ? Goal.Sit : Goal.Eating);
          }
          else
          {
            this.walkTowards(targetLocation);
          }
      }
    }, 1000/60);

    setInterval(() =>
    {
      if(this.state.dogAnimationWeight < 1)
      {
        return;
      }
  
      switch(this.state.dogGoal)
      {
        case Goal.Idle:
          this.considerGoals([
            {goal: Goal.Sit, odds: .1},
            {goal: Goal.Follow, odds: .9},
          ]);
        case Goal.Eating:
          this.considerGoals([
            {goal: Goal.Sit, odds: .1},
          ]);
        case Goal.Follow:
          this.considerGoals([
            {goal: Goal.Idle, odds: .1},
          ]);
        case Goal.GoEat:
        case Goal.Sit:
          this.considerGoals([
            {goal: Goal.Idle, odds: .1},
          ]);
      } 
    }, 1500);

    this.subscribeTo("positionChanged", (e) =>
    {
      this.setState({characterPosition: new Vector3(e.position.x, e.position.y, e.position.z)});
    }); 
  }

  getAnimationRates() : {idle: number, sit: number, walk: number} 
  {
    const weight = Math.min(Math.max(this.state.dogAnimationWeight, 0), 1);
    const inverse = 1 - weight;

    let sit = 0;
    let walk = 0;
    
    switch(this.state.dogPreviousGoal)
    {
      case Goal.Sit:
        sit = inverse;
        break;
      case Goal.Follow:
      case Goal.GoEat:
        walk = inverse;
        break;
    }

    switch(this.state.dogGoal)
    {
      case Goal.Sit:
        sit = weight;
        break;
      case Goal.Follow:
      case Goal.GoEat:
        walk = weight;
        break;
    }

    return {idle: 1 - (sit + walk), sit, walk};
  }

  considerGoals(goals: {goal: Goal, odds: number}[])
  {
    for(let i = 0; i < goals.length; i++)
    {
      if(Math.random() < goals[i].odds)
      {
        switch(goals[i].goal)
        {
          case Goal.Follow:
            if(!isInBounds(this.state.characterPosition))
            {
              continue;
            }
        }

        this.setDogGoal(goals[i].goal);
        return;
      }
    }
  }

  setDogGoal(goal: Goal)
  {
    this.setState({
      dogGoal: goal,
      dogAnimationWeight: 1 - this.state.dogAnimationWeight,
      dogPreviousGoal: this.state.dogGoal
    });
  }

  walkTowards(position: Vector3)
  {
    let delta = position.subtract(this.state.dogPosition);
    delta = delta.normalize().scale(.015); // .015 is the walk speed
    delta.y = 0;
    const newPosition = this.state.dogPosition.add(delta);
    if(!isInBounds(newPosition)) 
    {
      this.setDogGoal(Goal.Idle);
    }
    else
    {
      this.setState({
        dogPosition: newPosition,
        dogRotation: lookAt(this.state.dogPosition, position, -Math.PI / 2)
      });
    }
  }
    
  async render() 
  {
    let animationWeights = this.getAnimationRates();
    return (
      <scene>
        <gltf-model 
          id="Dog"
          src="art/BlockDog.gltf"
          position={this.state.dogPosition}
          rotation={this.state.dogRotation.toEulerAngles().scale(180 / Math.PI)}
          transition={{
            rotation: {
              duration: 300
            }
          }}
          skeletalAnimation={[
            { 
              clip: "Idle", 
              weight: animationWeights.idle,
            },
            { 
              clip: "Walking", 
              weight: animationWeights.walk,
            },
            { 
              clip: "Sit_Idle_2", 
              weight: animationWeights.sit,
            },
          ]}
          >
        </gltf-model>
        <box
          id="Bowl"
          position={this.state.bowlPosition}
        />
      </scene>
    )
  }
}

function isInBounds(position: Vector3): boolean
{
  return position.x > .5 && position.x < 9.5
    && position.z > .5 && position.z < 9.5;
}

// Math from Babylon TransformNode
function lookAt(
  pos: Vector3,
  targetPoint: Vector3, 
  yawCor: number = 0, 
  pitchCor: number = 0, 
  rollCor: number = 0): Quaternion 
{
  let dv = targetPoint.subtract(pos);
  var yaw = -Math.atan2(dv.z, dv.x) - Math.PI / 2;
  var len = Math.sqrt(dv.x * dv.x + dv.z * dv.z);
  var pitch = Math.atan2(dv.y, len);
  return Quaternion.RotationYawPitchRoll(yaw + yawCor, pitch + pitchCor, rollCor);
}