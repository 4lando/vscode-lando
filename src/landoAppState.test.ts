import * as assert from "assert";
import { suite, test, beforeEach } from "mocha";
import {
  LandoAppState,
  LandoAppStateMachine,
  StateChangeEvent,
  isRunning,
  isBusy,
  isStopped,
  isError,
  getStateLabel,
  BUSY_STATES,
} from "./landoAppState";

suite("LandoAppState Test Suite", () => {
  suite("Helper Functions", () => {
    test("isRunning returns true only for Running state", () => {
      assert.strictEqual(isRunning(LandoAppState.Running), true);
      assert.strictEqual(isRunning(LandoAppState.Stopped), false);
      assert.strictEqual(isRunning(LandoAppState.Starting), false);
      assert.strictEqual(isRunning(LandoAppState.Unknown), false);
    });

    test("isStopped returns true only for Stopped state", () => {
      assert.strictEqual(isStopped(LandoAppState.Stopped), true);
      assert.strictEqual(isStopped(LandoAppState.Running), false);
      assert.strictEqual(isStopped(LandoAppState.Stopping), false);
    });

    test("isBusy returns true for transitional states", () => {
      assert.strictEqual(isBusy(LandoAppState.Starting), true);
      assert.strictEqual(isBusy(LandoAppState.Stopping), true);
      assert.strictEqual(isBusy(LandoAppState.Rebuilding), true);
      assert.strictEqual(isBusy(LandoAppState.Destroying), true);
      assert.strictEqual(isBusy(LandoAppState.Running), false);
      assert.strictEqual(isBusy(LandoAppState.Stopped), false);
      assert.strictEqual(isBusy(LandoAppState.Error), false);
    });

    test("isError returns true only for Error state", () => {
      assert.strictEqual(isError(LandoAppState.Error), true);
      assert.strictEqual(isError(LandoAppState.Running), false);
      assert.strictEqual(isError(LandoAppState.Stopped), false);
    });

    test("getStateLabel returns human-readable labels", () => {
      assert.strictEqual(getStateLabel(LandoAppState.Unknown), "Unknown");
      assert.strictEqual(getStateLabel(LandoAppState.Stopped), "Stopped");
      assert.strictEqual(getStateLabel(LandoAppState.Starting), "Starting...");
      assert.strictEqual(getStateLabel(LandoAppState.Running), "Running");
      assert.strictEqual(getStateLabel(LandoAppState.Stopping), "Stopping...");
      assert.strictEqual(
        getStateLabel(LandoAppState.Rebuilding),
        "Rebuilding..."
      );
      assert.strictEqual(
        getStateLabel(LandoAppState.Destroying),
        "Destroying..."
      );
      assert.strictEqual(getStateLabel(LandoAppState.Error), "Error");
    });

    test("BUSY_STATES contains all transitional states", () => {
      assert.ok(BUSY_STATES.includes(LandoAppState.Starting));
      assert.ok(BUSY_STATES.includes(LandoAppState.Stopping));
      assert.ok(BUSY_STATES.includes(LandoAppState.Rebuilding));
      assert.ok(BUSY_STATES.includes(LandoAppState.Destroying));
      assert.strictEqual(BUSY_STATES.length, 4);
    });
  });

  suite("LandoAppStateMachine", () => {
    let stateMachine: LandoAppStateMachine;
    const testAppId = "testapp";

    beforeEach(() => {
      stateMachine = new LandoAppStateMachine();
    });

    suite("Initial State", () => {
      test("getState returns Unknown for untracked app", () => {
        const info = stateMachine.getState(testAppId);
        assert.strictEqual(info.state, LandoAppState.Unknown);
      });

      test("getState returns timestamp", () => {
        const info = stateMachine.getState(testAppId);
        assert.ok(info.timestamp instanceof Date);
      });
    });

    suite("Valid Transitions", () => {
      test("Unknown -> Stopped via poll", () => {
        stateMachine.updateFromPoll(testAppId, false);
        assert.strictEqual(
          stateMachine.getState(testAppId).state,
          LandoAppState.Stopped
        );
      });

      test("Unknown -> Running via poll", () => {
        stateMachine.updateFromPoll(testAppId, true);
        assert.strictEqual(
          stateMachine.getState(testAppId).state,
          LandoAppState.Running
        );
      });

      test("Unknown -> Starting when user starts before poll", () => {
        assert.strictEqual(stateMachine.markStarting(testAppId), true);
        assert.strictEqual(
          stateMachine.getState(testAppId).state,
          LandoAppState.Starting
        );
      });

      test("Stopped -> Starting -> Running", () => {
        stateMachine.updateFromPoll(testAppId, false); // Set to Stopped
        assert.strictEqual(stateMachine.markStarting(testAppId), true);
        assert.strictEqual(
          stateMachine.getState(testAppId).state,
          LandoAppState.Starting
        );

        stateMachine.updateFromPoll(testAppId, true);
        assert.strictEqual(
          stateMachine.getState(testAppId).state,
          LandoAppState.Running
        );
      });

      test("Running -> Stopping -> Stopped", () => {
        stateMachine.updateFromPoll(testAppId, true); // Set to Running
        assert.strictEqual(stateMachine.markStopping(testAppId), true);
        assert.strictEqual(
          stateMachine.getState(testAppId).state,
          LandoAppState.Stopping
        );

        stateMachine.updateFromPoll(testAppId, false);
        assert.strictEqual(
          stateMachine.getState(testAppId).state,
          LandoAppState.Stopped
        );
      });

      test("Running -> Rebuilding -> Running", () => {
        stateMachine.updateFromPoll(testAppId, true);
        assert.strictEqual(stateMachine.markRebuilding(testAppId), true);
        assert.strictEqual(
          stateMachine.getState(testAppId).state,
          LandoAppState.Rebuilding
        );

        stateMachine.updateFromPoll(testAppId, true);
        assert.strictEqual(
          stateMachine.getState(testAppId).state,
          LandoAppState.Running
        );
      });

      test("Running -> Destroying -> Stopped", () => {
        stateMachine.updateFromPoll(testAppId, true);
        assert.strictEqual(stateMachine.markDestroying(testAppId), true);
        assert.strictEqual(
          stateMachine.getState(testAppId).state,
          LandoAppState.Destroying
        );

        stateMachine.updateFromPoll(testAppId, false);
        assert.strictEqual(
          stateMachine.getState(testAppId).state,
          LandoAppState.Stopped
        );
      });
    });

    suite("Invalid Transitions", () => {
      test("Cannot stop a stopped app", () => {
        stateMachine.updateFromPoll(testAppId, false); // Stopped
        assert.strictEqual(stateMachine.markStopping(testAppId), false);
        assert.strictEqual(
          stateMachine.getState(testAppId).state,
          LandoAppState.Stopped
        );
      });

      test("Cannot start a running app", () => {
        stateMachine.updateFromPoll(testAppId, true); // Running
        assert.strictEqual(stateMachine.markStarting(testAppId), false);
        assert.strictEqual(
          stateMachine.getState(testAppId).state,
          LandoAppState.Running
        );
      });

      test("Cannot start while stopping", () => {
        stateMachine.updateFromPoll(testAppId, true);
        stateMachine.markStopping(testAppId);
        assert.strictEqual(stateMachine.markStarting(testAppId), false);
        assert.strictEqual(
          stateMachine.getState(testAppId).state,
          LandoAppState.Stopping
        );
      });

      test("Cannot stop while starting", () => {
        stateMachine.updateFromPoll(testAppId, false);
        stateMachine.markStarting(testAppId);
        assert.strictEqual(stateMachine.markStopping(testAppId), false);
        assert.strictEqual(
          stateMachine.getState(testAppId).state,
          LandoAppState.Starting
        );
      });

      test("Can rebuild a stopped app", () => {
        stateMachine.updateFromPoll(testAppId, false);
        assert.strictEqual(stateMachine.markRebuilding(testAppId), true);
        assert.strictEqual(
          stateMachine.getState(testAppId).state,
          LandoAppState.Rebuilding
        );
      });

      test("Can destroy a stopped app", () => {
        stateMachine.updateFromPoll(testAppId, false);
        assert.strictEqual(stateMachine.markDestroying(testAppId), true);
        assert.strictEqual(
          stateMachine.getState(testAppId).state,
          LandoAppState.Destroying
        );
      });
    });

    suite("Error State", () => {
      test("Can transition to Error from Starting", () => {
        stateMachine.updateFromPoll(testAppId, false);
        stateMachine.markStarting(testAppId);
        assert.strictEqual(
          stateMachine.markError(testAppId, "Start failed"),
          true
        );

        const info = stateMachine.getState(testAppId);
        assert.strictEqual(info.state, LandoAppState.Error);
        assert.strictEqual(info.errorMessage, "Start failed");
        assert.strictEqual(info.previousState, LandoAppState.Starting);
      });

      test("Error state is cleared by poll", () => {
        stateMachine.updateFromPoll(testAppId, false);
        stateMachine.markStarting(testAppId);
        stateMachine.markError(testAppId, "Failed");

        stateMachine.updateFromPoll(testAppId, false);
        assert.strictEqual(
          stateMachine.getState(testAppId).state,
          LandoAppState.Stopped
        );
      });

      test("Can retry from Error state", () => {
        stateMachine.updateFromPoll(testAppId, false);
        stateMachine.markStarting(testAppId);
        stateMachine.markError(testAppId, "Failed");

        assert.strictEqual(stateMachine.markStarting(testAppId), true);
        assert.strictEqual(
          stateMachine.getState(testAppId).state,
          LandoAppState.Starting
        );
      });
    });

    suite("canTransition", () => {
      test("Returns true for valid transitions", () => {
        stateMachine.updateFromPoll(testAppId, false);
        assert.strictEqual(
          stateMachine.canTransition(testAppId, LandoAppState.Starting),
          true
        );
      });

      test("Returns false for invalid transitions", () => {
        stateMachine.updateFromPoll(testAppId, false);
        assert.strictEqual(
          stateMachine.canTransition(testAppId, LandoAppState.Stopping),
          false
        );
      });
    });

    suite("Events", () => {
      test("Emits event on state change", () => {
        const events: StateChangeEvent[] = [];
        stateMachine.onDidChangeState((e) => events.push(e));

        stateMachine.updateFromPoll(testAppId, true);

        assert.strictEqual(events.length, 1);
        assert.strictEqual(events[0].appId, testAppId);
        assert.strictEqual(events[0].previousState, LandoAppState.Unknown);
        assert.strictEqual(events[0].newState, LandoAppState.Running);
      });

      test("Does not emit event when state unchanged", () => {
        const events: StateChangeEvent[] = [];
        stateMachine.updateFromPoll(testAppId, true); // First change
        stateMachine.onDidChangeState((e) => events.push(e));

        stateMachine.updateFromPoll(testAppId, true); // Same state

        assert.strictEqual(events.length, 0);
      });

      test("Includes error message in event", () => {
        const events: StateChangeEvent[] = [];
        stateMachine.updateFromPoll(testAppId, false);
        stateMachine.markStarting(testAppId);
        stateMachine.onDidChangeState((e) => events.push(e));

        stateMachine.markError(testAppId, "Command failed");

        assert.strictEqual(events.length, 1);
        assert.strictEqual(events[0].errorMessage, "Command failed");
      });
    });

    suite("App Management", () => {
      test("removeApp removes app from tracking", () => {
        stateMachine.updateFromPoll(testAppId, true);
        stateMachine.removeApp(testAppId);

        assert.strictEqual(
          stateMachine.getState(testAppId).state,
          LandoAppState.Unknown
        );
      });

      test("clear removes all tracked apps", () => {
        stateMachine.updateFromPoll("app1", true);
        stateMachine.updateFromPoll("app2", false);
        stateMachine.clear();

        assert.strictEqual(stateMachine.getTrackedApps().length, 0);
      });

      test("getTrackedApps returns all tracked app IDs", () => {
        stateMachine.updateFromPoll("app1", true);
        stateMachine.updateFromPoll("app2", false);

        const tracked = stateMachine.getTrackedApps();
        assert.strictEqual(tracked.length, 2);
        assert.ok(tracked.includes("app1"));
        assert.ok(tracked.includes("app2"));
      });
    });

    suite("External State Changes", () => {
      test("Detects external start (Stopped -> Running via poll)", () => {
        stateMachine.updateFromPoll(testAppId, false);
        stateMachine.updateFromPoll(testAppId, true);
        assert.strictEqual(
          stateMachine.getState(testAppId).state,
          LandoAppState.Running
        );
      });

      test("Detects external stop (Running -> Stopped via poll)", () => {
        stateMachine.updateFromPoll(testAppId, true);
        stateMachine.updateFromPoll(testAppId, false);
        assert.strictEqual(
          stateMachine.getState(testAppId).state,
          LandoAppState.Stopped
        );
      });

      test("Start command but still stopped on poll (external failure)", () => {
        stateMachine.updateFromPoll(testAppId, false);
        stateMachine.markStarting(testAppId);
        // Poll shows still stopped - start failed externally
        stateMachine.updateFromPoll(testAppId, false);
        assert.strictEqual(
          stateMachine.getState(testAppId).state,
          LandoAppState.Stopped
        );
      });

      test("Stop command but still running on poll (external failure)", () => {
        stateMachine.updateFromPoll(testAppId, true);
        stateMachine.markStopping(testAppId);
        // Poll shows still running - stop failed externally
        stateMachine.updateFromPoll(testAppId, true);
        assert.strictEqual(
          stateMachine.getState(testAppId).state,
          LandoAppState.Running
        );
      });
    });

    suite("Timestamp Tracking", () => {
      test("Updates timestamp on state change", async () => {
        stateMachine.updateFromPoll(testAppId, false);
        const firstTimestamp = stateMachine.getState(testAppId).timestamp;

        await new Promise((resolve) => setTimeout(resolve, 10));

        stateMachine.updateFromPoll(testAppId, true);
        const secondTimestamp = stateMachine.getState(testAppId).timestamp;

        assert.ok(
          secondTimestamp.getTime() > firstTimestamp.getTime(),
          "Timestamp should be updated"
        );
      });
    });
  });
});
