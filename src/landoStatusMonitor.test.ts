import * as assert from "assert";
import { suite, test, afterEach } from "mocha";
import { LandoStatusMonitor, LandoContainer } from "./landoStatusMonitor";
import { LandoApp } from "./landoAppDetector";
import * as vscode from "vscode";

/**
 * Creates a mock LandoApp for testing
 */
function createMockApp(name: string, cleanName?: string): LandoApp {
  return {
    name,
    cleanName: cleanName || name.toLowerCase().replace(/[-_]/g, ""),
    configPath: `/workspace/${name}/.lando.yml`,
    rootPath: `/workspace/${name}`,
    workspaceFolder: {
      uri: { fsPath: `/workspace/${name}` } as vscode.Uri,
      name: name,
      index: 0,
    },
    recipe: "drupal10",
    services: ["appserver", "database"],
  };
}

/**
 * Creates a mock container fetcher for testing
 */
function createMockFetcher(containers: LandoContainer[]): () => Promise<LandoContainer[]> {
  return async () => [...containers]; // Return a copy
}

/**
 * Creates a mutable mock fetcher that can be updated
 */
function createMutableFetcher(): { 
  fetcher: () => Promise<LandoContainer[]>; 
  setContainers: (c: LandoContainer[]) => void;
} {
  let containers: LandoContainer[] = [];
  return {
    fetcher: async () => [...containers],
    setContainers: (c: LandoContainer[]) => { containers = c; }
  };
}

suite("LandoStatusMonitor Test Suite", () => {
  let monitor: LandoStatusMonitor | undefined;

  afterEach(() => {
    monitor?.dispose();
    monitor = undefined;
  });

  suite("Initialization", () => {
    test("Should create monitor instance", () => {
      monitor = new LandoStatusMonitor({
        containerFetcher: createMockFetcher([])
      });
      assert.ok(monitor, "Monitor should be created");
    });

    test("Should have empty status map initially", () => {
      monitor = new LandoStatusMonitor({
        containerFetcher: createMockFetcher([])
      });
      const statuses = monitor.getAllStatuses();
      assert.strictEqual(statuses.length, 0, "Should have no statuses initially");
    });
  });

  suite("App Status Management", () => {
    test("Should set apps for monitoring", () => {
      monitor = new LandoStatusMonitor({
        containerFetcher: createMockFetcher([])
      });
      const apps = [createMockApp("test-app")];
      
      monitor.setApps(apps);
      
      // Apps should be set (though status may not be immediately available)
      assert.ok(true, "Should set apps without error");
    });

    test("Should return undefined status for unknown app", () => {
      monitor = new LandoStatusMonitor({
        containerFetcher: createMockFetcher([])
      });
      const unknownApp = createMockApp("unknown-app");
      const status = monitor.getStatus(unknownApp);
      
      assert.strictEqual(status, undefined, "Should return undefined for unknown app");
    });

    test("Should report not running for app without status", () => {
      monitor = new LandoStatusMonitor({
        containerFetcher: createMockFetcher([])
      });
      const app = createMockApp("test-app");
      const isRunning = monitor.isRunning(app);
      
      assert.strictEqual(isRunning, false, "Should report not running for app without status");
    });
  });

  suite("Container Status Parsing", () => {
    test("Should parse running containers from lando list output", async () => {
      const app = createMockApp("myapp");
      const containers: LandoContainer[] = [
        { service: "appserver", app: "myapp", running: true },
        { service: "database", app: "myapp", running: true },
      ];
      
      monitor = new LandoStatusMonitor({
        containerFetcher: createMockFetcher(containers)
      });

      monitor.setApps([app]);
      await monitor.refresh();

      const status = monitor.getStatus(app);
      
      assert.ok(status, "Status should be available");
      assert.strictEqual(status!.running, true, "App should be running");
      assert.strictEqual(status!.runningContainers, 2, "Should have 2 running containers");
      assert.strictEqual(status!.totalContainers, 2, "Should have 2 total containers");
    });

    test("Should parse stopped containers from lando list output", async () => {
      const app = createMockApp("myapp");
      const containers: LandoContainer[] = [
        { service: "appserver", app: "myapp", running: false },
        { service: "database", app: "myapp", running: false },
      ];
      
      monitor = new LandoStatusMonitor({
        containerFetcher: createMockFetcher(containers)
      });

      monitor.setApps([app]);
      await monitor.refresh();

      const status = monitor.getStatus(app);
      
      assert.ok(status, "Status should be available");
      assert.strictEqual(status!.running, false, "App should not be running");
      assert.strictEqual(status!.runningContainers, 0, "Should have 0 running containers");
      assert.strictEqual(status!.totalContainers, 2, "Should have 2 total containers");
    });

    test("Should handle mixed running state", async () => {
      const app = createMockApp("myapp");
      const containers: LandoContainer[] = [
        { service: "appserver", app: "myapp", running: true },
        { service: "database", app: "myapp", running: false },
      ];
      
      monitor = new LandoStatusMonitor({
        containerFetcher: createMockFetcher(containers)
      });

      monitor.setApps([app]);
      await monitor.refresh();

      const status = monitor.getStatus(app);
      
      assert.ok(status, "Status should be available");
      assert.strictEqual(status!.running, true, "App should be running if any container is running");
      assert.strictEqual(status!.runningContainers, 1, "Should have 1 running container");
      assert.strictEqual(status!.totalContainers, 2, "Should have 2 total containers");
    });

    test("Should handle no containers found", async () => {
      const app = createMockApp("myapp");
      
      monitor = new LandoStatusMonitor({
        containerFetcher: createMockFetcher([])
      });

      monitor.setApps([app]);
      await monitor.refresh();

      const status = monitor.getStatus(app);
      
      assert.ok(status, "Status should be available");
      assert.strictEqual(status!.running, false, "App should not be running with no containers");
      assert.strictEqual(status!.runningContainers, 0, "Should have 0 running containers");
      assert.strictEqual(status!.totalContainers, 0, "Should have 0 total containers");
    });

    test("Should match containers when Lando returns original app name with dashes", async () => {
      // App has cleanName "myapp" but Lando returns original name "my-app"
      const app = createMockApp("my-app");
      const containers: LandoContainer[] = [
        { service: "appserver", app: "my-app", running: true },
        { service: "database", app: "my-app", running: true },
      ];
      
      monitor = new LandoStatusMonitor({
        containerFetcher: createMockFetcher(containers)
      });

      monitor.setApps([app]);
      await monitor.refresh();

      const status = monitor.getStatus(app);
      
      assert.ok(status, "Status should be available");
      assert.strictEqual(status!.running, true, "App should be running");
      assert.strictEqual(status!.runningContainers, 2, "Should have 2 running containers");
      assert.strictEqual(status!.totalContainers, 2, "Should have 2 total containers");
    });

    test("Should match containers when Lando returns original app name with underscores", async () => {
      // App has cleanName "myapp" but Lando returns original name "my_app"
      const app = createMockApp("my_app");
      const containers: LandoContainer[] = [
        { service: "appserver", app: "my_app", running: true },
        { service: "database", app: "my_app", running: false },
      ];
      
      monitor = new LandoStatusMonitor({
        containerFetcher: createMockFetcher(containers)
      });

      monitor.setApps([app]);
      await monitor.refresh();

      const status = monitor.getStatus(app);
      
      assert.ok(status, "Status should be available");
      assert.strictEqual(status!.running, true, "App should be running");
      assert.strictEqual(status!.runningContainers, 1, "Should have 1 running container");
      assert.strictEqual(status!.totalContainers, 2, "Should have 2 total containers");
    });
  });

  suite("Multiple Apps", () => {
    test("Should track status for multiple apps", async () => {
      const app1 = createMockApp("app-one", "appone");
      const app2 = createMockApp("app-two", "apptwo");
      const containers: LandoContainer[] = [
        { service: "appserver", app: "appone", running: true },
        { service: "database", app: "appone", running: true },
        { service: "appserver", app: "apptwo", running: false },
        { service: "database", app: "apptwo", running: false },
      ];
      
      monitor = new LandoStatusMonitor({
        containerFetcher: createMockFetcher(containers)
      });

      monitor.setApps([app1, app2]);
      await monitor.refresh();

      const status1 = monitor.getStatus(app1);
      const status2 = monitor.getStatus(app2);
      
      assert.ok(status1, "Status for app1 should be available");
      assert.ok(status2, "Status for app2 should be available");
      assert.strictEqual(status1!.running, true, "App1 should be running");
      assert.strictEqual(status2!.running, false, "App2 should not be running");
    });

    test("Should remove status when app is removed", async () => {
      const app1 = createMockApp("app-one");
      const app2 = createMockApp("app-two");
      
      monitor = new LandoStatusMonitor({
        containerFetcher: createMockFetcher([])
      });

      // Set both apps
      monitor.setApps([app1, app2]);
      await monitor.refresh();
      
      // Now remove app2
      monitor.setApps([app1]);
      
      const statuses = monitor.getAllStatuses();
      
      // Should only have status for app1
      assert.strictEqual(statuses.length, 1, "Should only have 1 status after removal");
      assert.strictEqual(statuses[0].app.name, "app-one", "Should have status for app-one");
    });
  });

  suite("Event Emission", () => {
    test("Should emit status changed event when app starts", async () => {
      const app = createMockApp("myapp");
      let eventFired = false;
      let capturedWasRunning: boolean | undefined;
      let capturedIsRunning: boolean | undefined;

      const { fetcher, setContainers } = createMutableFetcher();
      
      monitor = new LandoStatusMonitor({
        containerFetcher: fetcher
      });

      monitor.onDidChangeStatus(event => {
        eventFired = true;
        capturedWasRunning = event.wasRunning;
        capturedIsRunning = event.status.running;
      });

      // First call: app is stopped
      setContainers([
        { service: "appserver", app: "myapp", running: false },
      ]);
      monitor.setApps([app]);
      await monitor.refresh();

      // Reset event tracking
      eventFired = false;
      capturedWasRunning = undefined;
      capturedIsRunning = undefined;

      // Second call: app is running
      setContainers([
        { service: "appserver", app: "myapp", running: true },
      ]);
      await monitor.refresh();

      assert.strictEqual(eventFired, true, "Event should be fired");
      assert.strictEqual(capturedWasRunning, false, "Was not running before");
      assert.strictEqual(capturedIsRunning, true, "Is running now");
    });

    test("Should emit status changed event when app stops", async () => {
      const app = createMockApp("myapp");
      let eventFired = false;
      let capturedWasRunning: boolean | undefined;
      let capturedIsRunning: boolean | undefined;

      const { fetcher, setContainers } = createMutableFetcher();
      
      monitor = new LandoStatusMonitor({
        containerFetcher: fetcher
      });

      monitor.onDidChangeStatus(event => {
        eventFired = true;
        capturedWasRunning = event.wasRunning;
        capturedIsRunning = event.status.running;
      });

      // First call: app is running
      setContainers([
        { service: "appserver", app: "myapp", running: true },
      ]);
      monitor.setApps([app]);
      await monitor.refresh();

      // Reset event tracking
      eventFired = false;
      capturedWasRunning = undefined;
      capturedIsRunning = undefined;

      // Second call: app is stopped
      setContainers([
        { service: "appserver", app: "myapp", running: false },
      ]);
      await monitor.refresh();

      assert.strictEqual(eventFired, true, "Event should be fired");
      assert.strictEqual(capturedWasRunning, true, "Was running before");
      assert.strictEqual(capturedIsRunning, false, "Is not running now");
    });

    test("Should not emit event when status unchanged", async () => {
      const app = createMockApp("myapp");
      let eventCount = 0;

      monitor = new LandoStatusMonitor({
        containerFetcher: createMockFetcher([
          { service: "appserver", app: "myapp", running: true },
        ])
      });

      monitor.onDidChangeStatus(() => {
        eventCount++;
      });
      
      monitor.setApps([app]);
      await monitor.refresh();
      eventCount = 0; // Reset after initial check
      
      await monitor.refresh();
      await monitor.refresh();
      await monitor.refresh();

      assert.strictEqual(eventCount, 0, "No events should be fired when status unchanged");
    });
  });

  suite("Error Handling", () => {
    test("Should handle container fetcher failure gracefully", async () => {
      const app = createMockApp("myapp");
      
      monitor = new LandoStatusMonitor({
        containerFetcher: async () => { throw new Error("Command failed"); }
      });

      monitor.setApps([app]);
      
      // Should not throw
      await monitor.refresh();
      
      assert.ok(true, "Should handle error gracefully");
    });
  });

  suite("Disposal", () => {
    test("Should dispose cleanly", () => {
      monitor = new LandoStatusMonitor({
        containerFetcher: createMockFetcher([])
      });
      monitor.setApps([createMockApp("test")]);
      
      // Should not throw
      monitor.dispose();
      monitor = undefined;
      
      assert.ok(true, "Should dispose without error");
    });
  });
});
