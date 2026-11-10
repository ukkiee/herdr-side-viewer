// Side Viewer Router: the default app for the taken-over extensions, so a cmd-click on a path
// in a Herdr terminal reaches the side viewer. Background-only: it never takes focus, hands
// each file on, and quits.
//   SideViewerRouter --make-default   record the original apps, then become the default
//   SideViewerRouter --restore        give every extension back to its original app
//   SideViewerRouter --status         extension, current default app, recorded original app
// The decisions live in takeover.sh and open-original.sh (bundled in Resources). This file
// only talks to macOS.
import Cocoa
import UniformTypeIdentifiers

let routerID = Bundle.main.bundleIdentifier ?? "dev.ukkiee.side-viewer-router"

// The scripts sit in Resources in the built app, and beside the binary's source otherwise.
func resource(_ name: String) -> String {
  if let dir = Bundle.main.resourcePath, FileManager.default.fileExists(atPath: dir + "/" + name) {
    return dir + "/" + name
  }
  return (CommandLine.arguments[0] as NSString).deletingLastPathComponent + "/" + name
}

@discardableResult
func runScript(_ name: String, _ arguments: [String]) -> Int32 {
  let process = Process()
  process.executableURL = URL(fileURLWithPath: "/bin/sh")
  process.arguments = [resource(name)] + arguments
  var environment = ProcessInfo.processInfo.environment
  environment["SIDE_VIEWER_ROUTER"] = Bundle.main.executablePath ?? CommandLine.arguments[0]
  environment["SIDE_VIEWER_ROUTER_ID"] = routerID
  process.environment = environment
  do { try process.run() } catch { return 127 }
  process.waitUntilExit()
  return process.terminationStatus
}

// macOS keeps default apps per file type, not per extension.
func fileType(_ ext: String) -> UTType? { UTType(filenameExtension: ext) }

func defaultApp(_ ext: String) -> String? {
  guard let type = fileType(ext), let app = NSWorkspace.shared.urlForApplication(toOpen: type) else { return nil }
  return Bundle(url: app)?.bundleIdentifier
}

func setDefaultApp(_ ext: String, _ bundleID: String) -> Never {
  guard let type = fileType(ext) else { fail("\(ext): no file type") }
  guard let app = NSWorkspace.shared.urlForApplication(withBundleIdentifier: bundleID) else {
    fail("\(bundleID): app not found")
  }
  NSWorkspace.shared.setDefaultApplication(at: app, toOpen: type) { error in
    if let error = error { fail("\(ext): \(error.localizedDescription)") }
    exit(0)
  }
  // Some file types make macOS ask the person; do not hang forever if nobody answers.
  DispatchQueue.main.asyncAfter(deadline: .now() + 30) { fail("\(ext): timed out") }
  dispatchMain()
}

func fail(_ message: String) -> Never {
  FileHandle.standardError.write((message + "\n").data(using: .utf8)!)
  exit(1)
}

// The one place that knows both the opened file and the app that was in front.
// Ticket 02 puts the branch to the side viewer here; until then every file goes to its original app.
func route(file: String, frontApp: String) {
  runScript("open-original.sh", [file])
}

final class Router: NSObject, NSApplicationDelegate {
  var handled = false

  func application(_ application: NSApplication, open urls: [URL]) {
    handled = true
    // The router never comes to the front, so this is still the app the click happened in.
    let front = NSWorkspace.shared.frontmostApplication
    let frontApp = front?.bundleURL?.path ?? front?.localizedName ?? ""
    for url in urls { route(file: url.path, frontApp: frontApp) }
    NSApp.terminate(nil)
  }

  func applicationDidFinishLaunching(_ notification: Notification) {
    // Launched without a file (a double-click on the app): nothing to do.
    DispatchQueue.main.asyncAfter(deadline: .now() + 2) { if !self.handled { NSApp.terminate(nil) } }
  }
}

let arguments = Array(CommandLine.arguments.dropFirst())
switch arguments.first {
case "--make-default": exit(runScript("takeover.sh", ["make-default"]))
case "--restore": exit(runScript("takeover.sh", ["restore"]))
case "--status": exit(runScript("takeover.sh", ["status"]))
case "--default-app" where arguments.count == 2:
  print(defaultApp(arguments[1]) ?? "")
  exit(0)
case "--set-default-app" where arguments.count == 3:
  setDefaultApp(arguments[1], arguments[2])
case "--type-info" where arguments.count == 2:
  // For checking what else rides along with an extension: its file type, that type's other
  // extensions, and the broader types it belongs to.
  guard let type = fileType(arguments[1]) else { fail("\(arguments[1]): no file type") }
  let extensions = (type.tags[.filenameExtension] ?? []).joined(separator: ",")
  let parents = type.supertypes.map(\.identifier).sorted().joined(separator: ",")
  print("\(type.identifier)\t\(extensions)\t\(parents)")
  exit(0)
default:
  let app = NSApplication.shared
  let router = Router()
  app.delegate = router
  app.setActivationPolicy(.prohibited)
  app.run()
}
