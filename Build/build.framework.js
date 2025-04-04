/**
 * Unity WebGL Framework
 * Initializes and manages a Unity instance in a web environment.
 * @module UnityFramework
 */

/** @class */
class UnityFramework {
  constructor() {
    this.Module = {};
    this.isReady = false;
    this.environment = this.detectEnvironment();
    this.initialize();
  }

  /**
   * Detects the runtime environment (browser, Node.js, or worker).
   * @returns {Object} Environment flags
   */
  detectEnvironment() {
    return {
      isWeb: typeof window === "object",
      isWorker: typeof importScripts === "function",
      isNode: typeof process === "object" && typeof process.versions === "object" && typeof process.versions.node === "string",
    };
  }

  /**
   * Initializes the Unity framework.
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      const scriptDirectory = await this.getScriptDirectory();
      this.Module = this.createModule(scriptDirectory);
      await this.setupFilesystem();
      await this.setupWebGL();
      await this.setupAudio();
      this.isReady = true;
      console.log("Unity Framework initialized successfully.");
    } catch (error) {
      console.error("Failed to initialize Unity Framework:", error);
      throw new UnityError("Initialization failed", error);
    }
  }

  /**
   * Determines the script directory based on the environment.
   * @returns {Promise<string>} Script directory path
   */
  async getScriptDirectory() {
    if (this.environment.isWeb && typeof document !== "undefined" && document.currentScript) {
      return document.currentScript.src;
    } else if (this.environment.isNode) {
      return __filename;
    }
    return "";
  }

  /**
   * Creates the base Module object with default properties.
   * @param {string} scriptDirectory - Path to the script
   * @returns {Object} Module configuration
   */
  createModule(scriptDirectory) {
    const module = {
      ready: new Promise((resolve, reject) => {
        this.Module.readyPromiseResolve = resolve;
        this.Module.readyPromiseReject = reject;
      }),
      print: console.log.bind(console),
      printErr: console.warn.bind(console),
      preRun: [],
      postRun: [],
      scriptDirectory,
    };
    return module;
  }

  /**
   * Sets up the filesystem for Unity.
   * @returns {Promise<void>}
   */
  async setupFilesystem() {
    const { Module } = this;
    if (!this.environment.isWorker) {
      Module.preRun.push(() => {
        const FS = Module.FS;
        FS.mkdir("/idbfs");
        FS.mount(Module.IDBFS, {}, "/idbfs");
        Module.addRunDependency("JS_FileSystem_Mount");
        FS.syncfs(true, (err) => {
          if (err) console.warn("IndexedDB unavailable:", err);
          Module.removeRunDependency("JS_FileSystem_Mount");
        });
      });
    }
  }

  /**
   * Initializes WebGL context and utilities.
   * @returns {Promise<void>}
   */
  async setupWebGL() {
    const { Module } = this;
    Module.GL = {
      createContext: (canvas, attributes) => {
        const ctx = canvas.getContext("webgl", attributes);
        if (!ctx) throw new Error("WebGL context creation failed");
        return ctx;
      },
      makeContextCurrent: (ctx) => {
        Module.ctx = ctx;
      },
    };
  }

  /**
   * Sets up audio handling for Unity.
   * @returns {Promise<void>}
   */
  async setupAudio() {
    const { Module } = this;
    Module.WEBAudio = {
      audioContext: new (window.AudioContext || window.webkitAudioContext)(),
      audioInstances: {},
      init: () => {
        console.log("Web Audio initialized.");
      },
    };
    Module.WEBAudio.init();
  }

  /**
   * Sends a message to the Unity instance.
   * @param {string} gameObject - Target GameObject name
   * @param {string} func - Function name to call
   * @param {any} [param] - Optional parameter
   */
  sendMessage(gameObject, func, param) {
    const { Module } = this;
    const funcPtr = this.stringToUTF8(func);
    const objPtr = this.stringToUTF8(gameObject);
    let paramPtr = 0;
    try {
      if (param === undefined) {
        Module._SendMessage(objPtr, funcPtr);
      } else if (typeof param === "string") {
        paramPtr = this.stringToUTF8(param);
        Module._SendMessageString(objPtr, funcPtr, paramPtr);
      } else if (typeof param === "number") {
        Module._SendMessageFloat(objPtr, funcPtr, param);
      } else {
        throw new Error(`Unsupported parameter type: ${typeof param}`);
      }
    } finally {
      Module._free(paramPtr);
      Module._free(objPtr);
      Module._free(funcPtr);
    }
  }

  /**
   * Converts a string to a UTF-8 encoded pointer.
   * @param {string} str - String to convert
   * @returns {number} Pointer to UTF-8 string
   */
  stringToUTF8(str) {
    const { Module } = this;
    const len = Module.lengthBytesUTF8(str) + 1;
    const ptr = Module._malloc(len);
    Module.stringToUTF8(str, ptr, len);
    return ptr;
  }
}

/**
 * Custom error class for Unity Framework errors.
 */
class UnityError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = "UnityError";
    this.cause = cause;
  }
}

// Export the framework
const unityInstance = new UnityFramework();
export default unityInstance;
