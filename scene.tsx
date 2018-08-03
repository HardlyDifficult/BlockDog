/*
The dog will:
 - Usually follow the player (unless player is out of bounds)
 - Randomly sit or idle
 - Sit on command
 - Go eat on command

TODO what's up with the errors "Unable to load assets from /models/avatar/square-robot/head.glb: Failed to load scene."
*/

import * as DCL from 'metaverse-api'
import {Vector3, Quaternion} from "babylonjs";

class Character
{
  position: Vector3 = new Vector3(0, 0, 0);
}

class Bowl
{
  position: Vector3 = new Vector3(1, 0, 1);
}

class Dog 
{
  state: State;
  position: Vector3;
  rotation: Quaternion;
  animation_weight: number;

  constructor() 
  {
    this.state = new IdleState(this);
    this.position = new Vector3(9, 0, 9);
    this.rotation = new Quaternion(0, 0, 0, 1);
    this.animation_weight = 0;
  }

  walkTowards(position: Vector3)
  {
    this.rotation = lookAt(this.position, position, -Math.PI / 2);

    let delta = position.subtract(this.position);
    delta = delta.normalize().scale(.015);
    delta.y = 0;
    const new_position = this.position.add(delta);
    if(!isInBounds(new_position)) 
    {
      this.state = new IdleState(this);
    }
    else
    {
      this.position = new_position;
    }
  }
}

class State 
{
  dog: Dog;
  previous_state: State;

  constructor(dog: Dog) 
  {
    this.dog = dog;
    this.previous_state = dog.state;
    if(!dog.state) 
    {
      dog.animation_weight = 0;
    }
    else
    {
      dog.animation_weight = 1 - dog.animation_weight;
      if(dog.animation_weight < 0)
      {
        dog.animation_weight = 0;
      }
    }
  }

  onClick() 
  {
    this.dog.state = new SitState(this.dog);
  }

  onUpdate(bowl: Bowl)
  {
    this.dog.animation_weight += .01;
  }

  onSlowUpdate(character: Character)
  {
    if(Math.random() < .1)
    {
      this.dog.state = new SitState(this.dog);
    }
    else if(this.canFollow(character) && Math.random() < .8) 
    {
      this.dog.state = new FollowState(character, this.dog);
    }
  }

  onClickBowl()
  {
    this.dog.state = new GoEatState(this.dog);
  }

  canFollow(character: Character) : boolean
  {
    return isInBounds(character.position)
  }

  getAnimationRates() : {idle: number, sit: number, walk: number} 
  {
    let sit = 0;
    let walk = 0;
    if(this.previous_state instanceof SitState) 
    {
      sit = 1 - this.dog.animation_weight;
    }
    else
    {
      walk = 1 - this.dog.animation_weight;
    }
    return {idle: this.dog.animation_weight, sit, walk};
  }
}
class IdleState extends State { }
class SitState extends State 
{
  getAnimationRates() 
  {
    return {idle: 1 - this.dog.animation_weight, sit: this.dog.animation_weight, walk: 0};
  }
  
  onSlowUpdate(character: Character)
  {
    if(Math.random() < .1)
    {
      this.dog.state = new IdleState(this.dog);
    }
  }

  onClick()
  {
    this.dog.state = new IdleState(this.dog);
  }
}
class FollowState extends State 
{
  target_location: Vector3;

  constructor(character: Character, dog: Dog) 
  {
    super(dog);
    this.target_location = character.position;
  }

  onSlowUpdate(character: Character)
  {
    if(Math.random() < .01)
    {
      this.dog.state = new IdleState(this.dog);
    }
    else
    {
      this.target_location = character.position;
    }
  }

  onUpdate(bowl: Bowl)
  {
    let delta = this.target_location.subtract(this.dog.position);
    if(delta.lengthSquared() < 1.5) 
    {
      this.dog.state = new SitState(this.dog);
    }
    else
    {
      this.dog.walkTowards(this.target_location);
      super.onUpdate(bowl);
    }
  }
}
class GoEatState extends State 
{
  getAnimationRates() 
  {
    let idle = 0;
    let sit = 0;
    if(this.previous_state instanceof SitState)
    {
      sit = 1 - this.dog.animation_weight;
    }
    else
    {
      idle = 1 - this.dog.animation_weight;
    }
    return {idle, sit, walk: this.dog.animation_weight};
  }

  onUpdate(bowl: Bowl)
  {
    let delta_to_bowl: Vector3 = bowl.position.subtract(this.dog.position);
    if(delta_to_bowl.lengthSquared() < 1.5) 
    {
      this.dog.state = new EatingState(this.dog);
    }
    else 
    {
      this.dog.walkTowards(bowl.position);
      super.onUpdate(bowl);
    }
  }

  onSlowUpdate() {}
}
class EatingState extends State 
{
  onSlowUpdate(character: Character)
  {
    if(Math.random() < .1)
    {
      this.dog.state = new SitState(this.dog);
    }
  }
}

export default class SampleScene extends DCL.ScriptableScene 
{
  state: {character: Character, dog: Dog, bowl: Bowl} = {
    character: new Character(),
    dog: new Dog(),
    bowl: new Bowl(),
  };

  sceneDidMount()
  {
    this.eventSubscriber.on("Bowl_click", () =>
    {
      let dog = this.state.dog;
      dog.state.onClickBowl();
      this.setState({dog: dog});
    });

    this.eventSubscriber.on("Doggo_click", () => 
    {
      let dog = this.state.dog;
      dog.state.onClick();
      this.setState({dog: dog});
    });

    setInterval(() => 
    {
      let dog = this.state.dog;
      dog.state.onUpdate(this.state.bowl);
      this.setState({dog: dog});
    }, 1000/60);
    
    setInterval(() => 
    {
      let dog = this.state.dog;
      if(dog.animation_weight > .7)
      {
        dog.state.onSlowUpdate(this.state.character);
      }
      this.setState({dog: dog});
    }, 1500);

    this.subscribeTo("positionChanged", e => 
    {
      let character = this.state.character;
      character.position = new Vector3(e.position.x, e.position.y, e.position.z);
      this.setState({ character: character });
    });
  }

  async render() 
  {
    let animation_weights = this.state.dog.state.getAnimationRates();
    return (
      <scene>
        <gltf-model 
          id="Doggo"
          src="art/BlockDog.gltf"
          position={this.state.dog.position}
          rotation={this.state.dog.rotation.toEulerAngles().scale(180 / Math.PI)}
          transition={{
            rotation: {
              duration: 300
            }
          }}
          skeletalAnimation={[
            { 
              clip: "Idle", 
              weight: animation_weights.idle,
            },
            { 
              clip: "Walking", 
              weight: animation_weights.walk,
            },
            { 
              clip: "Sit_Idle_2", 
              weight: animation_weights.sit,
            },
          ]}
          >
        </gltf-model>
        <box
          id="Bowl"
          position={this.state.bowl.position}
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