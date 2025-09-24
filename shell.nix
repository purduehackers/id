{ pkgs ? import <nixpkgs> {} }:
pkgs.mkShell {
    nativeBuildInputs = with pkgs.buildPackages; [
        nodePackages.pnpm
        nodePackages.prisma
        nodejs_22
    ];
}
