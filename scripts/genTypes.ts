import { exec } from "child_process";
import path from "path";
import os from "os";

const outDir = path.join(process.cwd(), "src", "grpc");
const protoDir = path.join(process.cwd(), "proto");

const command = [
  "protoc",
  `--plugin=protoc-gen-ts=${path.join(process.cwd(), "node_modules", ".bin", `protoc-gen-ts${os.platform() === "win32" ? ".cmd" : ""}`)}`,
  `--js_out=import_style=commonjs,binary:${outDir}`,
  "--ts_opt=unary_rpc_promise=true",
  `--ts_out=${outDir}`,
  `-I ${protoDir}`,
  path.join(protoDir, "*.proto"),
].join(" ");

exec(command, (error, stdout, stderr) => {
  if (error) {
    console.error(error);
    return;
  }
  if (stderr) {
    console.error(stderr);
    return;
  }
  if (stdout) {
    console.log(stdout);
  }
  console.log("Generated successfully");
});
