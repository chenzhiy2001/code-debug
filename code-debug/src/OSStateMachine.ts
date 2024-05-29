// A simple state machine powering breakpoint group switching functionality.
// If you don't know how the following code works, please check
// https://dev.to/davidkpiano/you-don-t-need-a-library-for-state-machines-k7h
//
// You can also visualize this state machine interactively at
// https://stately.ai/registry/editor/8e3d023e-bd57-45ad-9a3c-d2ad1b304cc7?machineId=c1226f8e-8ac5-4b6c-8239-eda810f55a09&mode=Simulate

import { MI2DebugSession } from "./mibase";

export type Action = {
	type: DebuggerActions;
}

type Transition = {
	target: OSStates;
	actions?: Action[];
}

type OSStateMachine = {
	initial: OSStates;
	states: {
		[key in OSStates]: {
			on: { [key in OSEvents]?: Transition };
		}
	};
}

export enum OSStates {
	kernel,
	kernel_single_step_to_user,
	user,
	user_single_step_to_kernel
}

export enum OSEvents {
	STOPPED,
	AT_KERNEL,
	AT_KERNEL_TO_USER_BORDER,
	AT_USER,
	AT_USER_TO_KERNEL_BORDER,
}

export enum DebuggerActions {
	check_if_kernel_yet,
	check_if_user_yet,
	check_if_kernel_to_user_border_yet,
	check_if_user_to_kernel_border_yet,
	start_consecutive_single_steps,
	low_level_switch_breakpoint_group_to_high_level,
	high_level_switch_breakpoint_group_to_low_level,
	try_get_next_breakpoint_group_name,
}

// the OSStateMachine const is exported while the OSStateMachine type is NOT.
// if you change the behavior of this OSStateMachine, remember to add comments.
export const OSStateMachine: OSStateMachine = {
	initial: OSStates.kernel,
	states: {
		[OSStates.kernel] : {
			on: {
				[OSEvents.STOPPED]: {
					target: OSStates.kernel,
					actions: [
						{ type: DebuggerActions.try_get_next_breakpoint_group_name }, //if got, save it to a variable. if not, stay the same. initial is "initproc"
						{ type: DebuggerActions.check_if_kernel_to_user_border_yet }, //if yes, event `AT_KERNEL_TO_USER_BORDER` happens
					]
				},
				[OSEvents.AT_KERNEL_TO_USER_BORDER]: {
					target: OSStates.kernel_single_step_to_user,
					actions: [
						{ type: DebuggerActions.start_consecutive_single_steps }
					]
				}
			}
		},
		[OSStates.kernel_single_step_to_user]: {
			on: {
				[OSEvents.STOPPED]: {
					target: OSStates.kernel_single_step_to_user,
					actions: [
						{ type: DebuggerActions.check_if_user_yet } //if yes, event `AT_USER` happens. if no, keep single stepping
					]
				},
				[OSEvents.AT_USER]: {
					target: OSStates.user,
					actions: [
						// border breakpoint is included in breakpoint group.
						// also switch debug symbol file
						// after breakpoint group changed, set the next breakpoint group to the kernel's breakpoint group.
						{ type: DebuggerActions.low_level_switch_breakpoint_group_to_high_level }
					]
				}
			}
		},
		[OSStates.user]: {
			on: {
				[OSEvents.STOPPED]: {
					target: OSStates.user,
					actions: [
						{ type: DebuggerActions.check_if_user_to_kernel_border_yet }, //if yes, event `AT_USER_TO_KERNEL_BORDER` happens
					]
				},
				[OSEvents.AT_USER_TO_KERNEL_BORDER]: {
					target: OSStates.user_single_step_to_kernel,
					actions: [
						{ type: DebuggerActions.start_consecutive_single_steps }// no need to `get_next_breakpoint_group_name` because the breakpoint group is already set when kernel changed to user breakpoint group
					]
				}
			}
		},
		[OSStates.user_single_step_to_kernel]: {
			on: {
				[OSEvents.STOPPED]: {
					target: OSStates.user_single_step_to_kernel,
					actions: [
						{ type: DebuggerActions.check_if_kernel_yet } //if yes, event `AT_KERNEL` happens. if no, keep single stepping
					]
				},
				[OSEvents.AT_KERNEL]: {
					target: OSStates.kernel,
					actions: [
						// after breakpoint group changed, set the next breakpoint group to the former user breakpoint group as a default value.
						// if a hook is triggered during kernel execution, the next breakpoint group will be set to the return value of hook behavior function.
						{ type: DebuggerActions.high_level_switch_breakpoint_group_to_low_level } // including the border breakpoint
					]
				}
			}
		},
	}
};


export class OSEvent {
	type:OSEvents;
	constructor(eventType:OSEvents){
		this.type = eventType;
	}

}

export class OSState {
	status:OSStates;
	constructor(status:OSStates){
		this.status = status;
	}
}

// Please do the returned actions!
export function stateTransition(machine:OSStateMachine, state: OSState, event: OSEvent):[OSState, Action[]] {

	const nextStateNode = machine
		.states[state.status]
		.on?.[event.type]
		?? { target: state.status } as Transition;

	const nextState = {
		...state,
		status: nextStateNode.target
	};

	// // go through the actions to determine
	// // what should be done
	// nextStateNode.actions?.forEach(action => {
	// 	doActions(action)
	// });

	return [nextState, nextStateNode.actions];
}
