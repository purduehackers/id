{ pkgs ? import <nixpkgs> {} }:
let
  vercel = pkgs.writeShellScriptBin "vercel" ''
    exec ${pkgs.nodejs_22}/bin/npx --yes vercel "$@"
  '';
in
pkgs.mkShell {
  nativeBuildInputs = with pkgs.buildPackages; [
    deno
    nodejs_22
    turso-cli
    turso
    vercel
  ];
}
