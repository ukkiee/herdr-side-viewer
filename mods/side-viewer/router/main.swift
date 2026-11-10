// Side Viewer Router: the default app for the taken-over extensions, so a cmd-click on a path
// in a Herdr terminal reaches the side viewer. Background-only: it never takes focus, hands
// each file on, and quits.
//   SideViewerRouter --make-default   record the original apps, then become the default for
//                                     the markdown and image extensions
//   SideViewerRouter --make-default code   the same, plus the code extensions
//   SideViewerRouter --restore        give every extension back to its original app
//   SideViewerRouter --status         extension, current default app, recorded original app
// The decisions live in open.sh, takeover.sh and open-original.sh (bundled in Resources). This file
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

// Asked about a real file, not the file type: two extensions of one type can open in different
// apps (js in an IDE, mjs in a terminal), and the type-level answer hides that.
func defaultApp(_ ext: String) -> String? {
  let folder = FileManager.default.temporaryDirectory.appendingPathComponent("side-viewer-router-\(getpid())")
  let file = folder.appendingPathComponent("file." + ext)
  defer { try? FileManager.default.removeItem(at: folder) }
  do {
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    try Data("\n".utf8).write(to: file)
  } catch { return nil }
  guard let app = NSWorkspace.shared.urlForApplication(toOpen: file) else { return nil }
  return Bundle(url: app)?.bundleIdentifier
}

func setDefaultApp(_ ext: String, _ bundleID: String) -> Never {
  guard let type = fileType(ext) else { fail("\(ext): no file type", code: 4) }
  guard let app = NSWorkspace.shared.urlForApplication(withBundleIdentifier: bundleID) else {
    fail("\(bundleID): app not found", code: 3)
  }
  NSWorkspace.shared.setDefaultApplication(at: app, toOpen: type) { error in
    // Also how a "keep" in the confirmation window comes back; takeover.sh tells the two apart.
    if let error = error { fail("\(ext): \(error.localizedDescription)", code: 1) }
    exit(0)
  }
  // macOS shows a confirmation window for every change and the request waits on it. Leave the
  // person time to read and answer, but do not hang forever if nobody does.
  DispatchQueue.main.asyncAfter(deadline: .now() + confirmationWait) { fail("\(ext): timed out", code: 5) }
  dispatchMain()
}

// Seconds to wait for one confirmation window.
let confirmationWait: TimeInterval = 300

// Exit codes takeover.sh relies on: 1 macOS refused, 3 app not found, 4 no file type, 5 timed out.
func fail(_ message: String, code: Int32 = 1) -> Never {
  FileHandle.standardError.write((message + "\n").data(using: .utf8)!)
  exit(code)
}

// The one place that knows both the opened file and the app that was in front.
// open.sh decides between the side viewer and the original app, and falls back to the original
// app itself. 127 means the script could not be run at all, so the file still has to go somewhere.
func route(file: String, frontApp: String) {
  if runScript("open.sh", [file, frontApp]) == 127 {
    runScript("open-original.sh", [file])
  }
}

final class Router: NSObject, NSApplicationDelegate {
  var quit: DispatchWorkItem?

  func application(_ application: NSApplication, open urls: [URL]) {
    // The router never comes to the front, so this is still the app the click happened in.
    let front = NSWorkspace.shared.frontmostApplication
    let frontApp = front?.bundleURL?.path ?? front?.localizedName ?? ""
    for url in urls { route(file: url.path, frontApp: frontApp) }
    quitWhenIdle()
  }

  func applicationDidFinishLaunching(_ notification: Notification) {
    // Launched without a file (a double-click on the app): nothing to do.
    quitWhenIdle()
  }

  // Quitting right after a file loses a second file that macOS sent while the first was being
  // handled, so wait until no more have arrived for a moment.
  func quitWhenIdle() {
    quit?.cancel()
    let item = DispatchWorkItem { NSApp.terminate(nil) }
    quit = item
    DispatchQueue.main.asyncAfter(deadline: .now() + 2, execute: item)
  }
}

let arguments = Array(CommandLine.arguments.dropFirst())
switch arguments.first {
case "--make-default": exit(runScript("takeover.sh", ["make-default"] + arguments.dropFirst()))
case "--restore": exit(runScript("takeover.sh", ["restore"]))
case "--status": exit(runScript("takeover.sh", ["status"]))
case "--type-of" where arguments.count == 2:
  // Extensions with the same answer share one default app and one confirmation window.
  print(fileType(arguments[1])?.identifier ?? "")
  exit(0)
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
