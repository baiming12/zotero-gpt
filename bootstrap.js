function startup({ id, version, rootURI }, reason) {
  Services.scriptloader.loadSubScript(rootURI + "chrome/content/zoterogpt/index.js", { id, version, rootURI });
}

function shutdown(data, reason) {}
function install(data, reason) {}
function uninstall(data, reason) {}