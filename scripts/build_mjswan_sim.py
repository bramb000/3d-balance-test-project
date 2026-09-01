#!/usr/bin/env python3
"""Build a single-scene Unitree Go2 mjswan bundle for the balance-robot web app."""

from __future__ import annotations

import os
import shutil
from pathlib import Path

import mujoco
import onnx
from mjlab.envs.mdp import observations as obs_fns
from mjlab.managers.observation_manager import ObservationGroupCfg, ObservationTermCfg

import mjswan
from mjswan.envs.mdp.actions import JointPositionActionCfg
from mjswan.trace_env import build_single_entity_trace_env

ROOT = Path(__file__).resolve().parents[1]
DEMO = ROOT / ".mjswan-src" / "examples" / "demo"
OUT = ROOT / "client" / "public" / "mjswan"

GO2_HISTORY_STEPS = (0, 1, 2)


def velocity_command_padding(env, **_):
    import torch

    del env
    return torch.zeros(1, 13)


def main() -> None:
    os.chdir(DEMO)
    if OUT.exists():
        shutil.rmtree(OUT)

    builder = mjswan.Builder(base_path="/mjswan/")
    project = builder.add_project(name="Balance Robot", id="main")

    scene = (
        project.add_scene(
            control_dt=0.02,
            name="Go2",
            spec=mujoco.MjSpec.from_file("assets/unitree_go2/scene.xml"),
        )
        .set_viewer(
            mjswan.ViewerConfig(
                lookat=(0.0, 0.0, 0.7),
                distance=3.8,
                elevation=-20.0,
                azimuth=34.0,
                origin_type=mjswan.ViewerConfig.OriginType.ASSET_BODY,
                body_name="base",
            )
        )
        .set_trace_env(
            build_single_entity_trace_env(
                lambda: mujoco.MjSpec.from_file("assets/unitree_go2/go2.xml")
            )
        )
    )

    go2_actions = {
        "joint_pos": JointPositionActionCfg(
            scale=0.5,
            stiffness=25.0,
            damping=0.5,
        )
    }

    go2_velocity_obs = {
        "policy": ObservationGroupCfg(
            terms={
                "projected_gravity": ObservationTermCfg(
                    func=obs_fns.projected_gravity, history_steps=GO2_HISTORY_STEPS
                ),
                "joint_pos": ObservationTermCfg(
                    func=obs_fns.joint_pos_rel, history_steps=GO2_HISTORY_STEPS
                ),
                "joint_vel": ObservationTermCfg(
                    func=obs_fns.joint_vel_rel, history_steps=GO2_HISTORY_STEPS
                ),
                "prev_actions": ObservationTermCfg(
                    func=obs_fns.last_action,
                    history_steps=GO2_HISTORY_STEPS,
                    history_interleaved=True,
                ),
            }
        ),
        "command_": ObservationGroupCfg(
            terms={
                "velocity_cmd": ObservationTermCfg(
                    func=obs_fns.generated_commands,
                    params={"command_name": "velocity"},
                ),
                "velocity_cmd_pad": ObservationTermCfg(func=velocity_command_padding),
            }
        ),
    }

    scene.add_policy(
        policy=onnx.load("assets/unitree_go2/vanilla.onnx"),
        name="Vanilla",
        config_path="assets/unitree_go2/vanilla.json",
        actions=go2_actions,
        observations=go2_velocity_obs,
        commands={
            "velocity": mjswan.velocity_command(
                lin_vel_x=(-1.0, 1.0),
                lin_vel_y=(-1.0, 1.0),
                ang_vel_z=(-0.5, 0.5),
                default_lin_vel_x=0.0,
                default_lin_vel_y=0.0,
                default_ang_vel_z=0.0,
            )
        },
        default=True,
    )

    app = builder.build(out_dir=str(OUT))
    print(f"Built mjswan bundle at {OUT}")
    print(f"Config: {OUT / 'config.json'}")


if __name__ == "__main__":
    main()
